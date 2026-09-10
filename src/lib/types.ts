export type Mode = "translate" | "grammar" | "polish";
export type Direction = "auto" | "zh2en" | "en2zh";
export type StyleId = "formal" | "academic" | "concise" | "casual" | "custom";
export type ModelId = "qwen3" | "qwen3_8" | "m2m100" | "llama32_1b";
/** 界面显示语言（与 explainLang「说明语言」不同：后者控制 AI 输出的说明文字） */
export type UiLang = "zh" | "en";

export interface Settings {
  autoRead: boolean;
  autoCopy: boolean;
  model: ModelId;
  explainLang: "zh" | "en";
  uiLang: UiLang;
}

export interface ChangeItem {
  original: string;
  revised: string;
  reason: string;
}

export interface ProcessOk {
  result: string;
  changes: ChangeItem[] | null;
  detectedLang: "zh" | "en";
  direction: "zh2en" | "en2zh" | null;
  model: string;
  neuronEstimate: number;
  usage: Usage;
}

export interface Usage {
  used: number;
  limit: number;
  date: string;
}

export interface HistoryItem {
  id: string;
  time: number;
  mode: Mode;
  source: string;
  result: string;
  changes: ChangeItem[] | null;
  styleLabel: string | null;
  /** 翻译方向（旧记录可能缺失；用于避免锁定方向时误命中相反方向的缓存） */
  direction?: "zh2en" | "en2zh" | null;
}

/** 润色风格，按展示顺序；文案由 i18n 的 style.* 键提供 */
export const STYLES: StyleId[] = ["formal", "academic", "concise", "casual", "custom"];

export const MODEL_INFO: Record<ModelId, { name: string; neurons: number }> = {
  qwen3: { name: "Qwen3-30B-A3B", neurons: 5 },
  qwen3_8: { name: "Qwen3.8-27B", neurons: 20 },
  m2m100: { name: "M2M-100 1.2B", neurons: 2 },
  llama32_1b: { name: "Llama-3.2 1B", neurons: 1 },
};

export const CHAR_MAX = 4000;
export const DEDUPE_WINDOW = 5 * 60 * 1000;
