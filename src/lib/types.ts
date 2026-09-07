export type Mode = "translate" | "grammar" | "polish";
export type Direction = "auto" | "zh2en" | "en2zh";
export type StyleId = "formal" | "academic" | "concise" | "casual" | "custom";
export type ModelId = "glm" | "qwen3";

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
}

export const MODE_LABELS: Record<Mode, string> = { translate: "翻译", grammar: "语法检查", polish: "润色" };

export const STYLES: Array<{ id: StyleId; label: string }> = [
  { id: "formal", label: "正式" },
  { id: "academic", label: "学术" },
  { id: "concise", label: "简洁" },
  { id: "casual", label: "口语" },
  { id: "custom", label: "自定义" },
];

export const MODEL_INFO: Record<ModelId, { name: string; tag: string; desc: string }> = {
  glm: { name: "GLM-4.7 Flash", tag: "默认", desc: "质量优先 · 中英最佳" },
  qwen3: { name: "Qwen3-30B-A3B", tag: "轻快", desc: "响应更快 · 更省额度" },
};

export const CHAR_MAX = 4000;
export const DEDUPE_WINDOW = 5 * 60 * 1000;
