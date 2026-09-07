import { Icon } from "./Icon";
import { CHAR_MAX, MODE_LABELS } from "../lib/types";
import type { Mode } from "../lib/types";

interface SourceProps {
  mode: Mode;
  source: string;
  onSource: (v: string) => void;
  busy: boolean;
  onRun: () => void;
  onPaste: () => void;
  onClear: () => void;
}

export function SourcePanel({ mode, source, onSource, busy, onRun, onPaste, onClear }: SourceProps) {
  const over = source.length > CHAR_MAX;
  const runLabel = mode === "translate" ? "翻译" : mode === "grammar" ? "检查" : "润色";
  return (
    <section className="glass panel" aria-label="原文">
      <div className="panel-head">
        <span className="panel-title"><Icon name="clipboard" size={15} />原文 · 剪贴板</span>
        <div className="panel-head-right">
          {source ? (
            <button className="btn ghost small" onClick={onClear} disabled={busy}><Icon name="x" size={13} />清空</button>
          ) : null}
        </div>
      </div>
      <div className="panel-body" style={{ display: "flex" }}>
        <textarea
          className="src-textarea"
          placeholder={"在此粘贴或输入原文…\n激活窗口时会自动读取剪贴板并开始" + MODE_LABELS[mode] + "。"}
          value={source}
          onChange={(e) => onSource(e.target.value)}
          spellCheck={false}
        />
        {!source ? (
          <div className="empty-state">
            <span className="empty-icon"><Icon name="clipboard" size={26} /></span>
            <span className="empty-title">等待剪贴板内容</span>
            <span className="empty-sub">从其他 App 切回本窗口时自动读取剪贴板并开始处理；也可以直接 ⌘V 粘贴。</span>
            <div className="kbd-hints">
              <span><kbd>⌘V</kbd>粘贴</span>
              <span><kbd>⌘⏎</kbd>立即运行</span>
            </div>
          </div>
        ) : null}
      </div>
      <div className="panel-foot">
        <span className={"char-count" + (over ? " over" : "")}>{source.length.toLocaleString()} / {CHAR_MAX.toLocaleString()}</span>
        <div className="spacer" />
        <button className="btn small" onClick={onPaste} disabled={busy}><Icon name="clipboardPaste" size={13} />粘贴</button>
        <button className="btn accent small" onClick={onRun} disabled={busy || !source.trim() || over}>
          <Icon name="play" size={12} />{runLabel}
        </button>
      </div>
    </section>
  );
}
