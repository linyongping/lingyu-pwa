export type Mode = "translate" | "grammar" | "polish";
export type Direction = "auto" | "zh2en" | "en2zh";
export type StyleId = "formal" | "academic" | "concise" | "casual" | "custom";
export type ModelId = "qwen3" | "qwen3_8" | "m2m100" | "llama32_1b";

export interface Settings {
  autoRead: boolean;
  autoCopy: boolean;
  model: ModelId;
  explainLang: "zh" | "en";
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

export const MODE_LABELS: Record<Mode, string> = { translate: "翻译", grammar: "语法检查", polish: "润色" };

export const STYLES: Array<{ id: StyleId; label: string }> = [
  { id: "formal", label: "正式" },
  { id: "academic", label: "学术" },
  { id: "concise", label: "简洁" },
  { id: "casual", label: "口语" },
  { id: "custom", label: "自定义" },
];

export const MODEL_INFO: Record<ModelId, { name: string; tag: string; desc: string; neurons: number }> = {
  qwen3: { name: "Qwen3-30B-A3B", tag: "默认", desc: "快速省额度 · ~10s", neurons: 5 },
  qwen3_8: { name: "Qwen3.8-27B", tag: "旗舰", desc: "262k 上下文 · 多模态 · 质量优先", neurons: 20 },
  m2m100: { name: "M2M-100 1.2B", tag: "翻译专用", desc: "100 语言 · 最便宜 · 仅翻译", neurons: 2 },
  llama32_1b: { name: "Llama-3.2 1B", tag: "极速", desc: "超轻量 · 仅简单翻译", neurons: 1 },
};

export const CHAR_MAX = 4000;
export const DEDUPE_WINDOW = 5 * 60 * 1000;
