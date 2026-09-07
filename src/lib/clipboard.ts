import { CHAR_MAX } from "./types";

export type ClipResult = { ok: true; value: string } | { ok: false; reason: "denied" | "empty" | "unsupported" };

export async function readClipboard(): Promise<ClipResult> {
  if (!navigator.clipboard || !navigator.clipboard.readText) return { ok: false, reason: "unsupported" };
  try {
    const text = await navigator.clipboard.readText();
    if (!text || !text.trim()) return { ok: false, reason: "empty" };
    return { ok: true, value: text.trim() };
  } catch {
    return { ok: false, reason: "denied" };
  }
}

export async function writeClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard || !navigator.clipboard.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** 链接或过短的内容不做自动处理 */
export function isSkippable(text: string): boolean {
  const t = text.trim();
  return t.length < 2 || /^https?:\/\/\S+$/i.test(t);
}

export function overLimit(text: string): boolean {
  return text.length > CHAR_MAX;
}

export function detectLang(text: string): "zh" | "en" {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  if (cjk + latin === 0) return "zh";
  return cjk / (cjk + latin) > 0.3 ? "zh" : "en";
}
