import type { Direction, Mode, StyleId } from "./types";
import { detectLang } from "./lang";

/**
 * 模型白名单（ID 均对照 Cloudflare 官方模型目录核实）：
 * - qwen3: 默认 · 快速省额度（MoE 3B 激活，~10s）
 * - qwen3.8: 旗舰质量 · 多模态 · 262k 上下文
 * - m2m100: 翻译专用 · 100 语言 · 最便宜
 * - llama3.2_1b: 超轻量 · 极速 · 仅适合简单翻译
 * - llama3.2_3b: 轻量 chat · 日常翻译/润色够用
 * - llama3.1_8b_fast: 8B 快速版 · 质量与成本均衡
 * - granite_micro: IBM Granite micro · 极省额度
 */
export const MODELS: Record<string, string> = {
  qwen3: "@cf/qwen/qwen3-30b-a3b-fp8",
  qwen3_8: "@cf/qwen/qwen3.8-27b",
  m2m100: "@cf/meta/m2m100-1.2b",
  llama32_1b: "@cf/meta/llama-3.2-1b-instruct",
  llama32_3b: "@cf/meta/llama-3.2-3b-instruct",
  llama31_8b_fast: "@cf/meta/llama-3.1-8b-instruct-fast",
  granite_micro: "@cf/ibm-granite/granite-4.0-h-micro",
};
export const DEFAULT_MODEL = "qwen3";

/** 每次请求的估算神经元消耗（Workers AI 计费单位，仅供参考；实际值以 Cloudflare 账单为准） */
export const NEURON_ESTIMATE: Record<string, number> = {
  qwen3: 5,
  qwen3_8: 20,
  m2m100: 2,
  llama32_1b: 1,
  llama32_3b: 2,
  llama31_8b_fast: 4,
  granite_micro: 1,
};

const STYLE_INSTRUCTIONS: Record<Exclude<StyleId, "custom">, string> = {
  formal: "正式书面语：用词准确、结构清晰，避免口语、语气词与缩略（如英文避免 don't / can't），保持专业但自然。",
  academic: "学术风格：严谨客观，多用书面与名词化表达，避免主观与情绪化措辞，术语使用规范。",
  concise: "简洁风格：删减冗余与套话，句子尽量短，但必须保留全部关键信息。",
  casual: "轻松口语：自然友好，像日常对话或内部群聊，可使用常见缩略与轻快语气。",
};

function explainIn(explainLang: "zh" | "en"): string {
  return explainLang === "en" ? "English（英文）" : "简体中文";
}

function langName(lang: "zh" | "en"): string {
  return lang === "zh" ? "中文" : "英文";
}

function translateSystem(direction: "zh2en" | "en2zh"): string {
  const pair = direction === "zh2en" ? "中文翻译成地道、自然的英文" : "英文翻译成流畅、准确的中文";
  return [
    `你是专业译者。将用户文本${pair}。`,
    "规则：",
    "1. 只做翻译：不要润色、解释或评论，也不要输出原文。",
    "2. 忠实传达原意，符合目标语言的表达习惯，不逐词直译，不擅自增删信息或改变语气。",
    "3. 专有名词、产品名、人名保留原文或使用通用译名；数字、日期、单位、URL、代码原样保留。",
    "4. 严格保留原文的换行、段落、序号、列表符号与代码块。",
    '5. 只输出一个 JSON 对象：{"result":"译文","changes":null}，不要输出任何解释、前后缀或代码块标记。',
  ].join("\n");
}

function grammarSystem(explainLang: "zh" | "en", sourceLang: "zh" | "en"): string {
  const name = langName(sourceLang);
  return [
    `你是严格的文字校对助手，只修正错误，不做风格改写。原文语言：${name}，输出必须仍是${name}。`,
    "规则：",
    "1. 中文文本：修正错别字、用词与语病、标点误用；英文文本：修正 grammar、spelling、punctuation、usage。",
    "2. 严禁翻译：输出语言必须与原文一致。",
    "3. 本身正确的句子与用词保持原样，不要为了「更优美」而改写；不改变原意和语气。",
    "4. 严格保留原文格式（换行、列表、代码块），只改必须改的地方。",
    "5. 若完全没有错误，result 返回原文，changes 返回空数组 []。",
    '6. changes 是数组，每项为 {"original":"原文中有误的片段，必须与原文逐字一致","revised":"修正后的片段，必须逐字出现在 result 中","reason":"简要说明修改理由"}；reason 用' + explainIn(explainLang) + "。",
    '7. 只输出一个 JSON 对象：{"result":"修正后的全文","changes":[...]}，不要输出任何其他内容。',
  ].join("\n");
}

function styleInstructionFor(style: StyleId, customPrompt: string): string {
  return style === "custom"
    ? `遵循用户给出的自定义风格指令：${customPrompt || "在保持原意的前提下优化表达。"}`
    : STYLE_INSTRUCTIONS[style];
}

function polishSystem(style: StyleId, customPrompt: string, explainLang: "zh" | "en", sourceLang: "zh" | "en"): string {
  const styleInstruction = styleInstructionFor(style, customPrompt);
  const name = langName(sourceLang);
  return [
    `你是专业文字润色助手。对用户文本做**同语言**润色：输入是${name}，输出必须仍然是${name}。`,
    `风格要求：${styleInstruction}`,
    "硬性要求：",
    `1. 严禁翻译：不要把原文翻译成其他语言，也不要「先译成${langName(sourceLang === "zh" ? "en" : "zh")}再译回来」。`,
    `2. 直接逐句润色，保留原意、语气与全部关键信息；不新增观点，不遗漏信息。`,
    `3. 用自然的${name}写作：中文避免翻译腔与生硬欧化句式，英文符合母语者习惯。`,
    "4. 专有名词、产品名、人名、数字、日期、单位、引用与代码保持原样。",
    "5. 严格保留格式（换行、列表、代码块）。",
    '6. changes 数组列出主要改写点，每项 {"original":"原文片段","revised":"改写后片段（必须逐字出现在 result 中）","reason":"简要说明"}；reason 用' + explainIn(explainLang) + "。",
    '7. 只输出一个 JSON 对象：{"result":"润色后的全文","changes":[...]}，不要输出任何其他内容。',
  ].join("\n");
}

function naturalSystem(explainLang: "zh" | "en", sourceLang: "zh" | "en"): string {
  const from = sourceLang === "zh" ? "原文是中文" : "原文是英文";
  return [
    `你是英文母语编辑。把用户文本改写成英语母语者最自然、地道的英文表达。${from}。`,
    "规则：",
    "1. 英文原文：做地道化改写（句式、搭配、语序、用词），含义与全部信息保持不变；中文原文：给出对应的地道英文表达。",
    "2. 不要逐字直译，也不要保留原文别扭的结构；但要保留全部信息，不新增观点。",
    "3. 严格保留原文格式（换行、列表、代码块、专有名词、数字与代码）。",
    '4. changes 数组列出主要地道化改动，每项 {"original":"原文片段","revised":"改写后片段（必须逐字出现在 result 中）","reason":"简要说明"}；reason 用' + explainIn(explainLang) + "。",
    '5. 只输出一个 JSON 对象：{"result":"改写后的全文","changes":[...]}，不要输出任何其他内容。',
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
    system = grammarSystem(opts.explainLang, detectLang(text));
    temperature = 0.1;
  } else if (mode === "natural") {
    system = naturalSystem(opts.explainLang, detectLang(text));
    temperature = 0.5;
  } else {
    system = polishSystem(opts.style, opts.customPrompt, opts.explainLang, detectLang(text));
    temperature = 0.7;
  }

  // 用户自定义提示词优先（前端设置页编辑，存 localStorage，请求时带上）
  if (systemPromptOverride) {
    // 自定义润色提示词若保留占位符，仍按当前风格替换，避免把 {style_instruction} 原样发给模型
    system = systemPromptOverride.replace(/\{style_instruction\}/g, styleInstructionFor(opts.style, opts.customPrompt));
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

