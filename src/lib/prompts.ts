/**
 * 预设提示词（与 worker/prompts.ts 同步）。
 * 用户可在设置页编辑，编辑后存 localStorage，发送请求时带上自定义提示词。
 * Worker 若收到 systemPrompt 则使用它，否则用默认。
 */

export type PromptKey = "translate_zh2en" | "translate_en2zh" | "grammar" | "polish";

export const PROMPT_LABELS: Record<PromptKey, string> = {
  translate_zh2en: "翻译 · 中→英",
  translate_en2zh: "翻译 · 英→中",
  grammar: "语法检查（双语）",
  polish: "润色（通用风格框架）",
};

const BASE_TRANSLATE_ZH2EN = `你是专业中译英译者。将用户文本翻译成地道、自然的英文。
规则：
1. 忠实传达原意，符合英文表达习惯，不要逐词直译。
2. 专有名词、产品名、人名保留原文或使用通用译名。
3. 严格保留原文的换行、段落、序号、列表符号与代码块，不增删信息。
4. 只输出一个 JSON 对象：{"result":"译文","changes":null}，不要输出任何其他内容。`;

const BASE_TRANSLATE_EN2ZH = `你是专业英译中译者。将用户文本翻译成流畅、准确的中文。
规则：
1. 忠实传达原意，符合中文表达习惯，不要逐词直译。
2. 专有名词、产品名、人名保留原文或使用通用译名。
3. 严格保留原文的换行、段落、序号、列表符号与代码块，不增删信息。
4. 只输出一个 JSON 对象：{"result":"译文","changes":null}，不要输出任何其他内容。`;

const BASE_GRAMMAR = `你是严格的双语文字校对助手。修正用户文本中的拼写、语法、标点与搭配错误，不改变原意和语气。
规则：
1. 中文文本：修正错别字、用词与语病、标点误用；英文文本：修正 grammar、spelling、punctuation、usage。
2. 严格保留原文格式（换行、列表、代码块），只改必须改的地方。
3. 若完全没有错误，result 返回原文，changes 返回空数组 []。
4. changes 是数组，每项为 {"original":"原文中有误的片段，必须与原文逐字一致","revised":"修正后的片段，必须逐字出现在 result 中","reason":"简要说明修改理由"}；reason 用简体中文。
5. 只输出一个 JSON 对象：{"result":"修正后的全文","changes":[...]}，不要输出任何其他内容。`;

const BASE_POLISH = `你是专业文字润色助手。在保持语言不变（中文润色后仍是中文、英文润色后仍是英文）的前提下，按指定风格改写用户文本。
风格要求：{style_instruction}
规则：
1. 保留原意与全部关键信息，不新增观点，不遗漏信息。
2. 严格保留格式（换行、列表、代码块）。
3. changes 数组列出主要改写点，每项 {"original":"原文片段","revised":"改写后片段（必须逐字出现在 result 中）","reason":"简要说明"}；reason 用简体中文。
4. 只输出一个 JSON 对象：{"result":"润色后的全文","changes":[...]}，不要输出任何其他内容。`;

export const DEFAULT_PROMPTS: Record<PromptKey, string> = {
  translate_zh2en: BASE_TRANSLATE_ZH2EN,
  translate_en2zh: BASE_TRANSLATE_EN2ZH,
  grammar: BASE_GRAMMAR,
  polish: BASE_POLISH,
};

const STORAGE_KEY = "ly_custom_prompts";

export function loadCustomPrompts(): Partial<Record<PromptKey, string>> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown;
    // 存储可能被写坏（"null"/数组/非对象），此时降级为「无自定义」
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Partial<Record<PromptKey, string>> = {};
    for (const key of Object.keys(DEFAULT_PROMPTS) as PromptKey[]) {
      const value = (raw as Record<string, unknown>)[key];
      if (typeof value === "string") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveCustomPrompts(prompts: Partial<Record<PromptKey, string>>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}

/** 获取最终使用的提示词（用户自定义优先，无则默认） */
export function getPrompt(key: PromptKey, custom: Partial<Record<PromptKey, string>>): string {
  return custom[key] ?? DEFAULT_PROMPTS[key];
}
