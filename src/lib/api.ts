import type { ModelId, ProcessOk, Usage } from "./types";
import { CHAR_MAX } from "./types";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function headers(passcode: string): HeadersInit {
  return { "content-type": "application/json", "x-passcode": passcode };
}

async function parseError(resp: Response): Promise<never> {
  let code = "http_" + resp.status;
  let message = `请求失败（HTTP ${resp.status}）`;
  try {
    const body = (await resp.json()) as { error?: { code?: string; message?: string } };
    if (body.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
    }
  } catch {
    // 保留默认信息
  }
  throw new ApiError(code, message, resp.status);
}

async function getJSON<T>(resp: Response): Promise<T> {
  if (!resp.ok) await parseError(resp);
  return (await resp.json()) as T;
}

export async function fetchUsage(passcode: string): Promise<Usage> {
  return getJSON<Usage>(await fetch("/api/usage", { headers: headers(passcode) }));
}

export interface ProcessParams {
  passcode: string;
  mode: "translate" | "grammar" | "polish";
  text: string;
  direction: "auto" | "zh2en" | "en2zh";
  style: string;
  customPrompt: string;
  systemPrompt?: string;
  explainLang: "zh" | "en";
  model: ModelId;
}

export async function processText(params: ProcessParams, signal?: AbortSignal): Promise<ProcessOk> {
  if (!params.text.trim()) throw new ApiError("empty_text", "文本为空", 0);
  if (params.text.length > CHAR_MAX) {
    throw new ApiError("too_long", `文本超过 ${CHAR_MAX} 字符上限（当前 ${params.text.length}）`, 422);
  }
  let resp: Response;
  try {
    resp = await fetch("/api/process", {
      method: "POST",
      headers: headers(params.passcode),
      signal,
      body: JSON.stringify({
        mode: params.mode,
        text: params.text,
        direction: params.direction,
        style: params.style,
        customPrompt: params.customPrompt,
        systemPrompt: params.systemPrompt,
        explainLang: params.explainLang,
        model: params.model,
      }),
    });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new ApiError("timeout", "请求超时（15 秒），请稍后重试", 0);
    throw new ApiError("network", "网络错误，请检查连接后重试", 0);
  }
  return getJSON<ProcessOk>(resp);
}
