/** 粗粒度中英文检测：CJK 字符占比 > 30% 判定为中文 */
export function detectLang(text: string): "zh" | "en" {
  return langInfo(text).lang;
}

/** 语言判定 + 字符计数，便于判断样本是否足以自信判定 */
export function langInfo(text: string): { lang: "zh" | "en"; cjk: number; latin: number } {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  if (cjk + latin === 0) return { lang: "zh", cjk, latin };
  return { lang: cjk / (cjk + latin) > 0.3 ? "zh" : "en", cjk, latin };
}

/** 两者语言是否明确不一致（任一样本字母/CJK 太少则不判定，避免误伤短文本） */
export function langMismatch(src: string, out: string): boolean {
  const a = langInfo(src);
  const b = langInfo(out);
  if (a.cjk + a.latin < 8 || b.cjk + b.latin < 8) return false;
  return a.lang !== b.lang;
}

/**
 * 从模型输出中提取 JSON 对象并做结构校验。
 * 容错顺序：原文直接 parse → 剥代码围栏 → 截取首尾大括号。
 */
export function parseModelJson(raw: string): { result: string; changes: Array<{ original: string; revised: string; reason: string }> | null } | null {
  const candidates: string[] = [];
  const trimmed = raw.trim();
  candidates.push(trimmed);

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      const obj = JSON.parse(candidate) as Record<string, unknown>;
      if (typeof obj.result !== "string" || !obj.result.trim()) continue;
      const rawChanges = obj.changes;
      let changes: Array<{ original: string; revised: string; reason: string }> | null = null;
      if (Array.isArray(rawChanges)) {
        changes = rawChanges
          .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
          .map((c) => ({
            original: String(c.original ?? ""),
            revised: String(c.revised ?? ""),
            reason: String(c.reason ?? ""),
          }))
          .filter((c) => c.original && c.revised);
      }
      return { result: obj.result, changes };
    } catch {
      // 尝试下一个候选
    }
  }
  return null;
}

/** JSON 彻底失败时的兜底：把模型输出当纯文本结果用 */
export function stripToFallbackText(raw: string): string {
  const fenced = raw.trim().match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  return body.trim();
}

/**
 * 模型 JSON 轻微破损时的兜底：用正则尽力提取 "result" 字段（小模型常出现未转义换行/尾逗号）。
 * 返回 null 表示取不到。
 */
export function salvageResult(raw: string): string | null {
  const m = raw.match(/"result"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
  if (!m) return null;
  try {
    const decoded = JSON.parse(`"${m[1]}"`) as string;
    return decoded.trim() || null;
  } catch {
    return m[1].trim() || null;
  }
}
