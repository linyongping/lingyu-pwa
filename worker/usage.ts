import type { Env } from "./types";

export interface Usage {
  used: number;
  limit: number;
  date: string;
}

/** 每日额度上限（env 变量解析，缺省 3000） */
export function dailyLimit(env: Env): number {
  return parseInt(env.DAILY_REQUEST_LIMIT ?? "3000", 10) || 3000;
}

/** 以 UTC 日期作为计数键（与 KV 过期时间对齐） */
export function today(): { key: string; date: string } {
  const date = new Date().toISOString().slice(0, 10);
  return { key: `usage:${date}`, date };
}

/**
 * 每日用量计数器（Durable Object）。
 *
 * 单实例串行 + storage.transaction() 保证「读-改-写」原子：并发请求不会像 KV 方案那样
 * 各自读到同一个旧值再各写 +1（导致少计、实际可能突破每日上限）。
 * 数据只存当前日期与计数，跨天自动归零。
 */
export class UsageCounter {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") ?? today().date;
    const limit = parseInt(url.searchParams.get("limit") ?? "3000", 10) || 3000;

    if (url.pathname.endsWith("/increment")) {
      const used = await this.state.storage.transaction(async (txn) => {
        const cur = (await txn.get<{ date: string; used: number }>("usage")) ?? null;
        const base = cur && cur.date === date ? cur.used : 0;
        const next = base + 1;
        await txn.put("usage", { date, used: next });
        return next;
      });
      return Response.json({ used, limit, date });
    }

    const cur = (await this.state.storage.get<{ date: string; used: number }>("usage")) ?? null;
    const used = cur && cur.date === date ? cur.used : 0;
    return Response.json({ used, limit, date });
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
      const resp = await stub.fetch(`https://usage/read?date=${date}&limit=${limit}`);
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
export async function incrementUsage(env: Env): Promise<Usage> {
  const { key, date } = today();
  const limit = dailyLimit(env);
  const stub = doStub(env);
  if (stub) {
    try {
      const resp = await stub.fetch(`https://usage/increment?date=${date}&limit=${limit}`);
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
