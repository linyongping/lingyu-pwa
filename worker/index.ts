import { tracing } from "cloudflare:workers";
import { buildMessages, DEFAULT_MODEL, MODELS, NEURON_ESTIMATE } from "./prompts";
import { detectLang, langMismatch, parseModelJson, salvageResult, stripToFallbackText } from "./lang";
import { incrementUsage, readUsage } from "./usage";
import type { Env, ProcessBody } from "./types";

// Durable Object 必须从入口模块具名导出，wrangler 才能注册
export { UsageCounter } from "./usage";

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

function extractText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.response === "string") return obj.response;
    if (typeof obj.result === "string") return obj.result;
    if (typeof obj.output_text === "string") return obj.output_text;
    if (typeof obj.translated_text === "string") return obj.translated_text;
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

/** 从模型响应里取真实 token 用量（chat 模型会带 usage；翻译模型通常没有） */
function extractTokenUsage(raw: unknown): { prompt: number; completion: number } {
  if (raw && typeof raw === "object") {
    const u = (raw as Record<string, unknown>).usage;
    if (u && typeof u === "object") {
      const rec = u as Record<string, unknown>;
      const prompt = Number(rec.prompt_tokens) || 0;
      const completion = Number(rec.completion_tokens) || 0;
      if (prompt || completion) return { prompt, completion };
    }
  }
  return { prompt: 0, completion: 0 };
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
  if (mode !== "translate" && mode !== "grammar" && mode !== "polish" && mode !== "natural") {
    return json(400, errorBody("bad_mode", "mode 必须是 translate / grammar / polish / natural"));
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return json(400, errorBody("empty_text", "文本为空"));
  if (text.length > MAX_CHARS) {
    return json(422, errorBody("too_long", `文本超过 ${MAX_CHARS} 字符上限（当前 ${text.length}）`));
  }

  const requestedKey = typeof body.model === "string" && body.model in MODELS ? body.model : DEFAULT_MODEL;
  // m2m100 只支持翻译接口（{text, source_lang, target_lang}）；非翻译模式退回默认 chat 模型，避免必然失败
  const modelKey = requestedKey === "m2m100" && mode !== "translate" ? DEFAULT_MODEL : requestedKey;
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

  // m2m100：翻译专用 seq2seq 模型，走 {text, source_lang, target_lang} 接口，直接返回译文
  if (modelKey === "m2m100") {
    let translated = "";
    try {
      const out = await tracing.enterSpan("chat", async (chatSpan) => {
        chatSpan.setAttribute("gen_ai.operation.name", "chat");
        chatSpan.setAttribute("gen_ai.agent.name", "lingyu");
        chatSpan.setAttribute("gen_ai.request.model", modelId);
        return env.AI.run(modelId, {
          text,
          source_lang: direction === "zh2en" ? "zh" : "en",
          target_lang: direction === "zh2en" ? "en" : "zh",
        });
      });
      translated = extractText(out).trim();
    } catch (err) {
      return json(502, errorBody("ai_error", `模型调用失败：${err instanceof Error ? err.message : "unknown"}`));
    }
    if (!translated) {
      return json(502, { error: { code: "bad_output", message: "模型没有返回可用内容" } });
    }
    const usage = await incrementUsage(env, { neurons: NEURON_ESTIMATE.m2m100 ?? 2 });
    return json(200, {
      result: translated,
      changes: null,
      detectedLang: detectLang(text),
      direction,
      model: "m2m100",
      neuronEstimate: NEURON_ESTIMATE.m2m100 ?? 2,
      usage,
    });
  }

  const callChat = (msgs: Array<{ role: string; content: string }>) =>
    tracing.enterSpan("chat", async (chatSpan) => {
      chatSpan.setAttribute("gen_ai.operation.name", "chat");
      chatSpan.setAttribute("gen_ai.agent.name", "lingyu");
      chatSpan.setAttribute("gen_ai.request.model", modelId);
      chatSpan.setAttribute("gen_ai.request.temperature", temperature);
      return runModel(env, modelId, msgs, temperature);
    });

  let rawOut: unknown = null;
  try {
    rawOut = await callChat(messages);
  } catch (err) {
    return json(502, errorBody("ai_error", `模型调用失败：${err instanceof Error ? err.message : "unknown"}`));
  }
  let raw = extractText(rawOut);

  let parsed = parseModelJson(raw);
  if (!parsed) {
    // 重试一次，强调只输出严格 JSON（小模型常出现未转义换行/尾逗号）
    const retryMessages = [
      ...messages,
      { role: "system" as const, content: 'Your previous output was not valid JSON. Output exactly one JSON object and nothing else. Use double quotes, escape newlines as \\n inside strings, and do not add trailing commas.' },
    ];
    try {
      rawOut = await callChat(retryMessages);
      raw = extractText(rawOut);
      parsed = parseModelJson(raw);
    } catch {
      // 保持 parsed 为空，走兜底
    }
  }

  // JSON 轻微破损：尽力从文本里取出 result 字段，避免把 JSON 原文当结果显示
  if (!parsed) {
    const salvaged = salvageResult(raw);
    if (salvaged) parsed = { result: salvaged, changes: null };
  }

  if (!parsed) {
    // 彻底失败：退化为纯文本结果
    const fallback = stripToFallbackText(raw);
    if (!fallback) {
      return json(502, { error: { code: "bad_output", message: "模型没有返回可用内容", raw: describeRaw(rawOut) } });
    }
    parsed = { result: fallback, changes: null };
  }

  // 语言一致性守卫：润色/校对必须与原文同语言。模型若「翻译了」，重试一次；仍不符则退回原文，
  // 避免把译文当润色结果返回（中文输入被译成英文、或英文被译成中文等）。
  const expectLang = mode === "polish" || mode === "grammar" ? detectLang(text) : null;
  if (expectLang && langMismatch(text, parsed.result)) {
    try {
      const guard = [
        ...messages,
        { role: "system" as const, content: `Wrong output language: it must match the source (${expectLang === "zh" ? "Chinese" : "English"}) and must not be a translation. Output exactly one JSON object.` },
      ];
      const out2 = await callChat(guard);
      const p2 = parseModelJson(extractText(out2)) ?? (() => { const s = salvageResult(extractText(out2)); return s ? { result: s, changes: null } : null; })();
      if (p2) {
        rawOut = out2; raw = extractText(out2); parsed = p2;
      }
    } catch {
      // 保持原结果，交给下面的兜底判断
    }
    if (langMismatch(text, parsed.result)) {
      parsed = { result: text, changes: null };
    }
  }

  const neuronEstimate = NEURON_ESTIMATE[modelKey] ?? 5;
  const tok = extractTokenUsage(rawOut);
  const usage = await incrementUsage(env, { prompt: tok.prompt, completion: tok.completion, neurons: neuronEstimate });
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
      return tracing.enterSpan("invoke_agent", async (span) => {
        span.setAttribute("gen_ai.operation.name", "invoke_agent");
        span.setAttribute("gen_ai.agent.name", "lingyu");
        return handleProcess(request, env);
      });
    }

    return json(404, errorBody("not_found", "未知接口"));
  },
} satisfies ExportedHandler<Env>;
