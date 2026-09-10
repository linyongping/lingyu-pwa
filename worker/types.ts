// Worker 环境绑定（保持最小接口，避免与 workers-types 严格泛型冲突）
export interface Env {
  /** Workers AI 绑定 */
  AI: {
    run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
  };
  /** 每日用量 KV（Durable Object 未绑定时的回退，近似计数） */
  USAGE_KV: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  };
  /** 每日用量原子计数（可选；未绑定则回退 USAGE_KV） */
  USAGE_DO?: DurableObjectNamespace;
  /** 静态资源（非 /api 路径兜底） */
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** wrangler secret */
  PASSCODE: string;
  /** 每日请求硬上限（字符串数字） */
  DAILY_REQUEST_LIMIT?: string;
}

export type Mode = "translate" | "grammar" | "polish";
export type Direction = "auto" | "zh2en" | "en2zh";
export type StyleId = "formal" | "academic" | "concise" | "casual" | "custom";

export interface ProcessBody {
  mode: Mode;
  text: string;
  direction?: Direction;
  style?: StyleId;
  customPrompt?: string;
  systemPrompt?: string;
  explainLang?: "zh" | "en";
  model?: string;
}

export interface ChangeItem {
  original: string;
  revised: string;
  reason: string;
}
