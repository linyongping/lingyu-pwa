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
  formal:
    "Formal written style: precise wording and clear structure; avoid colloquialisms, filler and contractions (e.g. avoid don't / can't in English); professional yet natural.",
  academic:
    "Academic style: rigorous and objective; favour formal and nominalized phrasing; avoid subjective or emotional wording; use terminology precisely.",
  concise:
    "Concise style: cut redundancy and filler, keep sentences short, but retain every key fact.",
  casual:
    "Casual style: friendly and natural, like everyday conversation or an internal chat; common contractions and a light tone are fine.",
};

/** 说明（changes[].reason）使用的语言，供提示词引用 */
function explainIn(explainLang: "zh" | "en"): string {
  return explainLang === "en" ? "English" : "Simplified Chinese";
}

function langName(lang: "zh" | "en"): string {
  return lang === "zh" ? "Chinese" : "English";
}

function translateSystem(direction: "zh2en" | "en2zh"): string {
  const pair = direction === "zh2en" ? "from Chinese into natural, idiomatic English" : "from English into fluent, accurate Chinese";
  return [
    `You are a professional translator. Translate the user's text ${pair}.`,
    "Rules:",
    "1. Translate only: do not polish, explain or comment, and do not output the source text.",
    "2. Convey the meaning faithfully in natural target-language style; do not translate word-for-word, and do not add, drop or change information or tone.",
    "3. Keep proper nouns, product names and people's names as-is or use their common English form. Keep numbers, dates, units, URLs and code exactly as given.",
    "4. Preserve the original line breaks, paragraphs, numbering, list markers and code blocks.",
    '5. Output exactly one JSON object: {"result":"<translation>","changes":null} — no explanations, prefixes/suffixes, or code fences.',
  ].join("\n");
}

function grammarSystem(explainLang: "zh" | "en", sourceLang: "zh" | "en"): string {
  const name = langName(sourceLang);
  return [
    `You are a strict proofreader. Fix errors only — never rewrite for style. Source language: ${name}. The output MUST remain in ${name}.`,
    "Rules:",
    "1. Chinese source: fix typos, wrong word choices, grammar problems and punctuation. English source: fix grammar, spelling, punctuation and usage.",
    "2. Never translate: the output language must match the source.",
    "3. Leave correct sentences and wording untouched; do not rephrase for elegance. Do not change meaning or tone.",
    "4. Preserve the original formatting (line breaks, lists, code blocks); change only what must change.",
    '5. If there are no errors, return the original text in "result" and an empty array [] for "changes".',
    '6. "changes" is an array of {"original":"the exact erroneous fragment from the source, verbatim","revised":"the corrected fragment, which must appear verbatim in result","reason":"short explanation"}. Write each "reason" in ' + explainIn(explainLang) + ".",
    '7. Output exactly one JSON object: {"result":"<corrected full text>","changes":[...]} — nothing else.',
  ].join("\n");
}

function styleInstructionFor(style: StyleId, customPrompt: string): string {
  return style === "custom"
    ? `Follow the user's custom style instruction: ${customPrompt || "improve the expression while preserving the meaning."}`
    : STYLE_INSTRUCTIONS[style];
}

function polishSystem(style: StyleId, customPrompt: string, explainLang: "zh" | "en", sourceLang: "zh" | "en"): string {
  const styleInstruction = styleInstructionFor(style, customPrompt);
  const name = langName(sourceLang);
  const other = langName(sourceLang === "zh" ? "en" : "zh");
  return [
    `You are a professional copy editor. Polish the user's text IN THE SAME LANGUAGE: the input is ${name}, so the output must remain ${name}.`,
    `Style requirement: ${styleInstruction}`,
    "Hard rules:",
    `1. Never translate: do not render the text in another language, and do not "translate it into ${other} and back". The output language must equal the input language.`,
    "2. Polish sentence by sentence and preserve the author's meaning, tone and every key fact; add no new ideas and omit nothing.",
    `3. Write natural, native-quality ${name}: ${sourceLang === "zh" ? "avoid translationese and stiff, Europeanized syntax." : "make it read the way a native speaker would write."}`,
    "4. Keep proper nouns, product names, people's names, numbers, dates, units, quotations and code exactly as-is.",
    "5. Preserve formatting (line breaks, lists, code blocks).",
    '6. "changes" lists the main edits as {"original":"fragment from the source","revised":"rewritten fragment (must appear verbatim in result)","reason":"short explanation"}. Write each "reason" in ' + explainIn(explainLang) + ".",
    '7. Output exactly one JSON object: {"result":"<polished full text>","changes":[...]} — nothing else.',
  ].join("\n");
}

function naturalSystem(explainLang: "zh" | "en", sourceLang: "zh" | "en"): string {
  const from = sourceLang === "zh" ? "The source text is Chinese." : "The source text is English.";
  return [
    `You are a native-English editor. Rewrite the user's text as natural, idiomatic English that a native speaker would actually use. ${from}`,
    "Rules:",
    "1. English source: make it idiomatic (sentence structure, collocations, word order, word choice) while keeping the meaning and all information unchanged. Chinese source: produce the corresponding idiomatic English rendering.",
    "2. Do not translate word-for-word and do not keep awkward source structures, but keep all information and add no new ideas.",
    "3. Preserve formatting (line breaks, lists, code blocks); keep proper nouns, numbers and code as-is.",
    '4. "changes" lists the main idiomatic edits as {"original":"fragment from the source","revised":"rewritten fragment (must appear verbatim in result)","reason":"short explanation"}. Write each "reason" in ' + explainIn(explainLang) + ".",
    '5. Output exactly one JSON object: {"result":"<rewritten full text>","changes":[...]} — nothing else.',
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

