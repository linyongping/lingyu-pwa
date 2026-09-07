import { Icon } from "./Icon";
import { MODE_LABELS, STYLES } from "../lib/types";
import type { ChangeItem, Direction, Mode, StyleId } from "../lib/types";
import { buildDiffSegments } from "../lib/diff";

export function DiffText({ corrected, changes }: { corrected: string; changes: ChangeItem[] }) {
  const segments = buildDiffSegments(corrected, changes);
  return (
    <div className="result-text">
      {segments.map((seg, i) =>
        seg.changeIdx === null ? (
          <span key={i}>{seg.text}</span>
        ) : (
          <mark key={i} className="ly-diff" title={changes[seg.changeIdx]?.reason ?? ""}>{seg.text}</mark>
        ),
      )}
    </div>
  );
}

export function ChangesList({ changes }: { changes: ChangeItem[] }) {
  return (
    <div className="changes">
      <div className="changes-title">改动说明 · {changes.length}</div>
      {changes.map((c, i) => (
        <div className="change-item" key={i}>
          <span className="change-no">{i + 1}</span>
          <div>
            <div className="change-pair">
              <span className="del">{c.original}</span>
              <span className="arrow">→</span>
              <span className="ins">{c.revised}</span>
            </div>
            {c.reason ? <div className="change-reason">{c.reason}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export interface AppError {
  title: string;
  desc: string;
}

interface ResultProps {
  mode: Mode;
  status: "idle" | "processing" | "done" | "error";
  result: { result: string; changes: ChangeItem[] | null; direction: "zh2en" | "en2zh" | null; model: string } | null;
  error: AppError | null;
  elapsed: string;
  showChanges: boolean;
  onToggleChanges: () => void;
  copied: "auto" | "manual" | "failed" | "pending" | null;
  onCopyResult: () => void;
  onCopyNotes: () => void;
  style: StyleId;
  onStyle: (s: StyleId) => void;
  direction: Direction;
  onCycleDirection: () => void;
  onEditCustom: () => void;
  modelLabel: string;
}

export function ResultPanel(props: ResultProps) {
  const { mode, status, result, error, elapsed, showChanges, onToggleChanges, copied } = props;
  const stageNames = ["读取剪贴板", "分析语言", mode === "translate" ? "生成译文" : mode === "grammar" ? "检查语法" : "润色语句"];
  const hasChanges = !!(result && result.changes && result.changes.length > 0);

  return (
    <section className="glass panel" aria-label="处理结果">
      <div className="panel-head">
        <span className="panel-title"><Icon name="wand" size={15} />{MODE_LABELS[mode]}结果</span>
        <div className="panel-head-right">
          {status === "done" && result ? <span className="chip dim">{elapsed}</span> : null}
        </div>
      </div>
      <div className="panel-body">
        {status === "idle" ? (
          <div className="empty-state">
            <span className="empty-icon"><Icon name="wand" size={26} /></span>
            <span className="empty-title">处理结果会出现在这里</span>
            <span className="empty-sub">选择上方模式后，粘贴内容将自动处理；结果默认自动写回剪贴板。</span>
          </div>
        ) : null}

        {status === "processing" ? (
          <div>
            <div className="steps">
              {stageNames.map((s, i) => (
                <span className={"step" + (i === 2 ? " active" : i < 2 ? " done" : "")} key={s}>
                  {i < 2 ? <Icon name="check" size={11} /> : null}{s}
                </span>
              ))}
            </div>
            <div className="skel">
              <div className="skel-line w40" />
              <div className="skel-line w95" />
              <div className="skel-line w80" />
              <div className="skel-line w95" />
              <div className="skel-line w60" />
            </div>
          </div>
        ) : null}

        {status === "error" && error ? (
          <div className="error-card">
            <Icon name="alert" size={19} />
            <div>
              <div className="error-title">{error.title}</div>
              <div className="error-desc">{error.desc}</div>
            </div>
          </div>
        ) : null}

        {status === "done" && result ? (
          <div>
            <div className="result-meta">
              {mode === "translate" && result.direction ? (
                <button className="chip accent clickable" onClick={props.onCycleDirection} title="点击切换方向锁定">
                  <Icon name="swap" size={12} />
                  {props.direction === "auto"
                    ? "自动识别 · " + (result.direction === "zh2en" ? "中文 → English" : "English → 中文")
                    : props.direction === "zh2en" ? "已锁定 中文 → English" : "已锁定 English → 中文"}
                </button>
              ) : null}
              {mode === "polish" ? (
                <span className="chip accent"><Icon name="wand" size={12} />{STYLES.find((s) => s.id === props.style)?.label ?? "正式"}风格</span>
              ) : null}
              {mode !== "translate" && hasChanges ? <span className="chip ok">{result.changes!.length} 处改动</span> : null}
            </div>

            {mode === "polish" ? (
              <div className="style-row">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    className={"style-chip" + (props.style === s.id ? " sel" : "")}
                    onClick={() => (s.id === "custom" ? props.onEditCustom() : props.onStyle(s.id))}
                  >{s.label}</button>
                ))}
              </div>
            ) : null}

            {mode === "grammar" && hasChanges ? (
              <DiffText corrected={result.result} changes={result.changes!} />
            ) : (
              <div className="result-text">{result.result}</div>
            )}

            {mode === "grammar" && hasChanges ? <ChangesList changes={result.changes!} /> : null}
            {mode === "polish" && hasChanges ? (
              <div className="changes">
                <div className="changes-title">
                  改动说明 · {result.changes!.length}
                  <button className="btn ghost small changes-toggle" onClick={onToggleChanges}>
                    <Icon name={showChanges ? "chevron" : "eye"} size={13} />{showChanges ? "收起" : "显示改动"}
                  </button>
                </div>
                {showChanges ? <ChangesList changes={result.changes!} /> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="panel-foot">
        {status === "done" && result ? (
          <>
            {copied === "auto" ? <span className="copy-ok"><Icon name="check" size={13} />已自动写回剪贴板 · 切回文档 ⌘V 粘贴</span> : null}
            {copied === "manual" ? <span className="copy-ok"><Icon name="check" size={13} />已复制</span> : null}
            {copied === "failed" ? <span className="copy-fail"><Icon name="alert" size={13} />复制失败，请手动选择复制</span> : null}
            {copied === "pending" ? <span className="copy-ok"><Icon name="check" size={13} />切回窗口后将自动写入剪贴板</span> : null}
            {copied === null ? <span style={{ opacity: 0.75 }}>结果已就绪</span> : null}
            <div className="spacer" />
            {hasChanges ? <button className="btn small" onClick={props.onCopyNotes}><Icon name="copy" size={12} />复制说明</button> : null}
            <button className="btn accent small" onClick={props.onCopyResult}><Icon name="copy" size={12} />复制结果</button>
          </>
        ) : (
          <span style={{ opacity: 0.75 }}>AI 结果 · {props.modelLabel}（Workers AI）</span>
        )}
      </div>
    </section>
  );
}
