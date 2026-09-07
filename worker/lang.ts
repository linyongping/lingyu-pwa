/** 粗粒度中英文检测：CJK 字符占比 > 30% 判定为中文 */
export function detectLang(text: string): "zh" | "en" {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  if (cjk + latin === 0) return "zh";
  return cjk / (cjk + latin) > 0.3 ? "zh" : "en";
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
