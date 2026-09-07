import { buildMessages, DEFAULT_MODEL, MODELS, NEURON_ESTIMATE } from "./prompts";
import { detectLang, parseModelJson, stripToFallbackText } from "./lang";
import type { Env, ProcessBody } from "./types";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" } as const;
const MAX_CHARS = 4000;

function json(status: number, body: unknown, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}

function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

/** 常数时间口令比较 */
function passcodeOk(request: Request, env: Env): boolean {
  const provided = request.headers.get("x-passcode") ?? "";
  const secret = env.PASSCODE ?? "";
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(secret);
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0 && secret.length > 0;
}

function todayKey(): { key: string; date: string } {
  const date = new Date().toISOString().slice(0, 10);
  return { key: `usage:${date}`, date };
}

async function readUsage(env: Env): Promise<{ used: number; limit: number; date: string }> {
  const { key, date } = todayKey();
  const raw = await env.USAGE_KV.get(key);
  const used = raw ? parseInt(raw, 10) || 0 : 0;
  const limit = parseInt(env.DAILY_REQUEST_LIMIT ?? "3000", 10) || 3000;
  return { used, limit, date };
}

async function incrementUsage(env: Env): Promise<{ used: number; limit: number; date: string }> {
  const current = await readUsage(env);
  const { key } = todayKey();
  const used = current.used + 1;
  await env.USAGE_KV.put(key, String(used), { expirationTtl: 172800 });
  return { ...current, used };
}

function extractText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.response === "string") return obj.response;
    if (typeof obj.result === "string") return obj.result;
    if (typeof obj.output_text === "string") return obj.output_text;
    if (Array.isArray(obj.choices)) {
      const first = obj.choices[0] as Record<string, unknown> | undefined;
      if (first && typeof first === "object") {
        const msg = first.message as Record<string, unknown> | undefined;
        if (msg && typeof msg.content === "string") return msg.content;
        if (typeof first.text === "string") return first.text;
      }
    }
  }
  return "";
}

function describeRaw(raw: unknown): string {
  try {
    const s = JSON.stringify(raw);
    return (s ?? String(raw)).slice(0, 600);
  } catch {
    return String(raw).slice(0, 600);
  }
}

async function runModel(env: Env, modelId: string, messages: Array<{ role: string; content: string }>, temperature: number): Promise<unknown> {
  return env.AI.run(modelId, { messages, max_tokens: 8000, temperature });
}

async function handleProcess(request: Request, env: Env): Promise<Response> {
  let body: ProcessBody;
  try {
    body = (await request.json()) as ProcessBody;
  } catch {
    return json(400, errorBody("bad_request", "请求体不是合法 JSON"));
  }

  const mode = body.mode;
  if (mode !== "translate" && mode !== "grammar" && mode !== "polish") {
    return json(400, errorBody("bad_mode", "mode 必须是 translate / grammar / polish"));
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return json(400, errorBody("empty_text", "文本为空"));
  if (text.length > MAX_CHARS) {
    return json(422, errorBody("too_long", `文本超过 ${MAX_CHARS} 字符上限（当前 ${text.length}）`));
  }

  const modelKey = typeof body.model === "string" && body.model in MODELS ? body.model : DEFAULT_MODEL;
  const modelId = MODELS[modelKey];
  const explainLang = body.explainLang === "en" ? "en" : "zh";
  const style = (["formal", "academic", "concise", "casual", "custom"] as const).includes(body.style as never)
    ? (body.style as ProcessBody["style"])
    : "formal";
  const customPrompt = typeof body.customPrompt === "string" ? body.customPrompt.slice(0, 2000) : "";
  const systemPromptOverride = typeof body.systemPrompt === "string" && body.systemPrompt.trim() ? body.systemPrompt.trim().slice(0, 4000) : "";
  const directionPref = body.direction === "zh2en" || body.direction === "en2zh" ? body.direction : "auto";

  const { messages, temperature, direction } = buildMessages(mode, text, {
    direction: directionPref,
    style: style ?? "formal",
    customPrompt,
    explainLang,
  }, systemPromptOverride);

  let rawOut: unknown = null;
  try {
    rawOut = await runModel(env, modelId, messages, temperature);
  } catch (err) {
    return json(502, errorBody("ai_error", `模型调用失败：${err instanceof Error ? err.message : "unknown"}`));
  }
  let raw = extractText(rawOut);

  let parsed = parseModelJson(raw);
  if (!parsed) {
    // 重试一次，强调只输出 JSON
    const retryMessages = [
      ...messages,
      { role: "system" as const, content: "上一次输出不是合法 JSON。必须只输出一个 JSON 对象本身，不要有任何其他字符。" },
    ];
    try {
      rawOut = await runModel(env, modelId, retryMessages, temperature);
      raw = extractText(rawOut);
      parsed = parseModelJson(raw);
    } catch {
      // 保持 parsed 为空，走兜底
    }
  }

  if (!parsed) {
    // 彻底失败：退化为纯文本结果
    const fallback = stripToFallbackText(raw);
    if (!fallback) {
      return json(502, { error: { code: "bad_output", message: "模型没有返回可用内容", raw: describeRaw(rawOut) } });
    }
    parsed = { result: fallback, changes: null };
  }

  const usage = await incrementUsage(env);
  const neuronEstimate = NEURON_ESTIMATE[modelKey] ?? 5;
  return json(200, {
    result: parsed.result,
    changes: parsed.changes,
    detectedLang: detectLang(text),
    direction: mode === "translate" ? direction : null,
    model: modelKey,
    neuronEstimate,
    usage,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (!passcodeOk(request, env)) {
      return json(401, errorBody("invalid_passcode", "口令错误"));
    }

    if (request.method === "GET" && url.pathname === "/api/usage") {
      const usage = await readUsage(env);
      return json(200, usage);
    }

    if (request.method === "POST" && url.pathname === "/api/process") {
      const usage = await readUsage(env);
      if (usage.used >= usage.limit) {
        return json(429, errorBody("quota_exceeded", "今日 AI 请求额度已用尽，明天自动恢复"));
      }
      return handleProcess(request, env);
    }

    return json(404, errorBody("not_found", "未知接口"));
  },
} satisfies ExportedHandler<Env>;
