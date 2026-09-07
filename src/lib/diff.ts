import type { ChangeItem } from "./types";

export interface DiffSegment {
  text: string;
  changeIdx: number | null;
}

/**
 * 用改动列表在修正后文本上定位高亮片段。
 * 模型约束了 revised 必须逐字出现在 result 中，因此按顺序做子串匹配即可；
 * 匹配不到的条目只出现在下方说明列表里，不影响正文。
 */
export function buildDiffSegments(corrected: string, changes: ChangeItem[] | null): DiffSegment[] {
  if (!changes || !changes.length) return [{ text: corrected, changeIdx: null }];
  const segments: DiffSegment[] = [];
  let pos = 0;
  changes.forEach((change, i) => {
    const needle = change.revised.trim();
    if (!needle || needle.startsWith("（删除")) return;
    const idx = corrected.indexOf(needle, pos);
    if (idx === -1) return;
    if (idx > pos) segments.push({ text: corrected.slice(pos, idx), changeIdx: null });
    segments.push({ text: corrected.slice(idx, idx + needle.length), changeIdx: i });
    pos = idx + needle.length;
  });
  if (pos < corrected.length) segments.push({ text: corrected.slice(pos), changeIdx: null });
  return segments.length ? segments : [{ text: corrected, changeIdx: null }];
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
