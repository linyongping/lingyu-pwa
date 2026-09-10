import type { Env } from "./types";

export interface Usage {
  used: number;
  limit: number;
  date: string;
  /** 当日真实 token 消耗（来自模型响应的 usage；无则缺省） */
  tokens?: { prompt: number; completion: number; total: number };
  /** 当日 neurons：Workers AI 未通过 binding 暴露真实值，这里为按模型估算（estimated=true） */
  neurons?: { used: number; limit: number; estimated: boolean };
}

/** 单次请求带来的增量 */
export interface UsageDelta {
  prompt?: number;
  completion?: number;
  neurons?: number;
}

interface StoredUsage {
  date: string;
  used: number;
  prompt: number;
  completion: number;
  neurons: number;
}

/** 每日请求上限（env 变量解析，缺省 3000） */
export function dailyLimit(env: Env): number {
  return parseInt(env.DAILY_REQUEST_LIMIT ?? "3000", 10) || 3000;
}

/** 每日 neurons 参考上限（缺省 10000 = Workers AI 免费额度） */
export function dailyNeuronLimit(env: Env): number {
  return parseInt(env.DAILY_NEURON_LIMIT ?? "10000", 10) || 10000;
}

/** 以 UTC 日期作为计数键（与 KV 过期时间对齐） */
export function today(): { key: string; date: string } {
  const date = new Date().toISOString().slice(0, 10);
  return { key: `usage:${date}`, date };
}

function shape(cur: StoredUsage | null, date: string, limit: number, neuronLimit: number): Usage {
  const same = cur && cur.date === date ? cur : null;
  // 兼容旧记录（没有 prompt/completion/neurons 字段）以及可能的 NaN
  const prompt = Number(same?.prompt) || 0;
  const completion = Number(same?.completion) || 0;
  return {
    used: Number(same?.used) || 0,
    limit,
    date,
    tokens: { prompt, completion, total: prompt + completion },
    neurons: { used: Number(same?.neurons) || 0, limit: neuronLimit, estimated: true },
  };
}

/**
 * 每日用量计数器（Durable Object）。
 *
 * 单实例串行 + storage.transaction() 保证「读-改-写」原子：并发请求不会像 KV 方案那样
 * 各自读到同一个旧值再各写 +1（导致少计、实际可能突破每日上限）。
 * 数据只存当前日期与各项计数，跨天自动归零。
 */
export class UsageCounter {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const q = url.searchParams;
    const date = q.get("date") ?? today().date;
    const limit = parseInt(q.get("limit") ?? "3000", 10) || 3000;
    const neuronLimit = parseInt(q.get("neuronLimit") ?? "10000", 10) || 10000;

    if (url.pathname.endsWith("/increment")) {
      const delta: UsageDelta = {
        prompt: Number(q.get("prompt")) || 0,
        completion: Number(q.get("completion")) || 0,
        neurons: Number(q.get("neurons")) || 0,
      };
      const result = await this.state.storage.transaction(async (txn) => {
        const cur = (await txn.get<StoredUsage>("usage")) ?? null;
        const base = cur && cur.date === date ? cur : { date, used: 0, prompt: 0, completion: 0, neurons: 0 };
        const next: StoredUsage = {
          date,
          used: (Number(base.used) || 0) + 1,
          prompt: (Number(base.prompt) || 0) + (delta.prompt ?? 0),
          completion: (Number(base.completion) || 0) + (delta.completion ?? 0),
          neurons: (Number(base.neurons) || 0) + (delta.neurons ?? 0),
        };
        await txn.put("usage", next);
        return next;
      });
      return Response.json(shape(result, date, limit, neuronLimit));
    }

    const cur = (await this.state.storage.get<StoredUsage>("usage")) ?? null;
    return Response.json(shape(cur, date, limit, neuronLimit));
  }
}

function doStub(env: Env): DurableObjectStub | null {
  return env.USAGE_DO ? env.USAGE_DO.get(env.USAGE_DO.idFromName("daily-usage")) : null;
}

/**
 * 读取当日用量：优先 Durable Object（原子、准确）；未绑定或调用异常时回退 KV。
 * KV 回退是「尽力而为」的近似值——KV 无原子自增，高并发下会少计，见 README「用量计数」。
 */
export async function readUsage(env: Env): Promise<Usage> {
  const { key, date } = today();
  const limit = dailyLimit(env);
  const stub = doStub(env);
  if (stub) {
    try {
      const resp = await stub.fetch(`https://usage/read?date=${date}&limit=${limit}&neuronLimit=${dailyNeuronLimit(env)}`);
      if (resp.ok) return (await resp.json()) as Usage;
    } catch {
      // 回退 KV
    }
  }
  const raw = await env.USAGE_KV.get(key);
  const used = raw ? parseInt(raw, 10) || 0 : 0;
  return { used, limit, date };
}

/** 递增当日用量：优先 Durable Object（原子）；否则 KV（并发下为近似值，方向为少计） */
export async function incrementUsage(env: Env, delta: UsageDelta = {}): Promise<Usage> {
  const { key, date } = today();
  const limit = dailyLimit(env);
  const stub = doStub(env);
  if (stub) {
    try {
      const q = new URLSearchParams({
        date,
        limit: String(limit),
        neuronLimit: String(dailyNeuronLimit(env)),
        prompt: String(delta.prompt ?? 0),
        completion: String(delta.completion ?? 0),
        neurons: String(delta.neurons ?? 0),
      });
      const resp = await stub.fetch(`https://usage/increment?${q}`);
      if (resp.ok) return (await resp.json()) as Usage;
    } catch {
      // 回退 KV
    }
  }
  const raw = await env.USAGE_KV.get(key);
  const used = (raw ? parseInt(raw, 10) || 0 : 0) + 1;
  await env.USAGE_KV.put(key, String(used), { expirationTtl: 172800 });
  return { used, limit, date };
}
