import type { ChangeItem, Direction, Mode, StyleId } from "./types";
import { detectLang } from "./lang";

/**
 * 模型白名单（均经实测在 Workers Free 套餐可用）：
 * - glm: 质量优先，中英最佳（GLM 中文强项）
 * - qwen3: 轻快省额度（MoE 3B 激活，响应快）
 */
export const MODELS: Record<string, string> = {
  glm: "@cf/zai-org/glm-4.7-flash",
  qwen3: "@cf/qwen/qwen3-30b-a3b-fp8",
};
export const DEFAULT_MODEL = "glm";

const STYLE_INSTRUCTIONS: Record<Exclude<StyleId, "custom">, string> = {
  formal: "正式书面语：用词准确、结构清晰，避免口语、语气词与缩略（如英文避免 don't / can't），保持专业但自然。",
  academic: "学术风格：严谨客观，多用书面与名词化表达，避免主观与情绪化措辞，术语使用规范。",
  concise: "简洁风格：删减冗余与套话，句子尽量短，但必须保留全部关键信息。",
  casual: "轻松口语：自然友好，像日常对话或内部群聊，可使用常见缩略与轻快语气。",
};

function explainIn(explainLang: "zh" | "en"): string {
  return explainLang === "en" ? "English（英文）" : "简体中文";
}

function translateSystem(direction: "zh2en" | "en2zh"): string {
  const pair = direction === "zh2en" ? "中文翻译成地道、自然的英文" : "英文翻译成流畅、准确的中文";
  return [
    `你是专业译者。将用户文本${pair}。`,
    "规则：",
    "1. 忠实传达原意，符合目标语言的表达习惯，不要逐词直译。",
    "2. 专有名词、产品名、人名保留原文或使用通用译名。",
    "3. 严格保留原文的换行、段落、序号、列表符号与代码块，不增删信息。",
    '4. 只输出一个 JSON 对象：{"result":"译文","changes":null}，不要输出任何解释、前后缀或代码块标记。',
  ].join("\n");
}

function grammarSystem(explainLang: "zh" | "en"): string {
  return [
    "你是严格的双语文字校对助手。修正用户文本中的拼写、语法、标点与搭配错误，不改变原意和语气。",
    "规则：",
    "1. 中文文本：修正错别字、用词与语病、标点误用；英文文本：修正 grammar、spelling、punctuation、usage。",
    "2. 严格保留原文格式（换行、列表、代码块），只改必须改的地方。",
    "3. 若完全没有错误，result 返回原文，changes 返回空数组 []。",
    '4. changes 是数组，每项为 {"original":"原文中有误的片段，必须与原文逐字一致","revised":"修正后的片段，必须逐字出现在 result 中","reason":"简要说明修改理由"}；reason 用' + explainIn(explainLang) + "。",
    '5. 只输出一个 JSON 对象：{"result":"修正后的全文","changes":[...]}，不要输出任何其他内容。',
  ].join("\n");
}

function polishSystem(style: StyleId, customPrompt: string, explainLang: "zh" | "en"): string {
  const styleInstruction =
    style === "custom"
      ? `遵循用户给出的自定义风格指令：${customPrompt || "在保持原意的前提下优化表达。"}`
      : STYLE_INSTRUCTIONS[style];
  return [
    "你是专业文字润色助手。在保持语言不变（中文润色后仍是中文、英文润色后仍是英文）的前提下，按指定风格改写用户文本。",
    `风格要求：${styleInstruction}`,
    "规则：",
    "1. 保留原意与全部关键信息，不新增观点，不遗漏信息。",
    "2. 严格保留格式（换行、列表、代码块）。",
    '3. changes 数组列出主要改写点，每项 {"original":"原文片段","revised":"改写后片段（必须逐字出现在 result 中）","reason":"简要说明"}；reason 用' + explainIn(explainLang) + "。",
    '4. 只输出一个 JSON 对象：{"result":"润色后的全文","changes":[...]}，不要输出任何其他内容。',
  ].join("\n");
}

export function resolveDirection(text: string, pref: Direction): "zh2en" | "en2zh" | null {
  if (pref === "zh2en" || pref === "en2zh") return pref;
  return detectLang(text) === "zh" ? "zh2en" : "en2zh";
}

export function buildMessages(
  mode: Mode,
  text: string,
  opts: { direction: Direction; style: StyleId; customPrompt: string; explainLang: "zh" | "en" },
  systemPromptOverride: string = "",
): { messages: Array<{ role: "system" | "user"; content: string }>; temperature: number; direction: "zh2en" | "en2zh" | null } {
  let system: string;
  let temperature: number;
  let direction: "zh2en" | "en2zh" | null = null;

  if (mode === "translate") {
    direction = resolveDirection(text, opts.direction);
    system = translateSystem(direction as "zh2en" | "en2zh");
    temperature = 0.2;
  } else if (mode === "grammar") {
    system = grammarSystem(opts.explainLang);
    temperature = 0.1;
  } else {
    system = polishSystem(opts.style, opts.customPrompt, opts.explainLang);
    temperature = 0.7;
  }

  // 用户自定义提示词优先（前端设置页编辑，存 localStorage，请求时带上）
  if (systemPromptOverride) {
    system = systemPromptOverride;
  }

  return {
    messages: [
      { role: "system", content: system },
      { role: "user", content: text },
    ],
    temperature,
    direction,
  };
}

export type { ChangeItem };
