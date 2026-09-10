import { Icon } from "./Icon";
import { STYLES } from "../lib/types";
import type { ChangeItem, Direction, Mode, StyleId } from "../lib/types";
import { buildDiffSegments } from "../lib/diff";
import { useI18n, type MsgKey } from "../lib/i18n";

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
  const { t } = useI18n();
  return (
    <div className="changes">
      <div className="changes-title">{t("result.changes.title", { n: changes.length })}</div>
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
  result: { result: string; changes: ChangeItem[] | null; direction: "zh2en" | "en2zh" | null; model: string; detectedLang?: "zh" | "en" } | null;
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
  fromHistory: boolean;
  onRerun: () => void;
  natural: { text: string; changes: ChangeItem[] | null } | null;
  naturalState: "idle" | "loading" | "done" | "error";
  onNatural: () => void;
  onCopyNatural: () => void;
  reverse: { intermediate: string; back: string } | null;
  reverseState: "idle" | "loading" | "done" | "error";
  onReverse: () => void;
  onCopyReverse: () => void;
}

export function ResultPanel(props: ResultProps) {
  const { t } = useI18n();
  const { mode, status, result, error, elapsed, showChanges, onToggleChanges, copied } = props;
  const stageNames = [
    t("result.stage.read"),
    t("result.stage.detect"),
    mode === "translate" ? t("result.stage.translate") : mode === "grammar" ? t("result.stage.grammar") : t("result.stage.polish"),
  ];
  const hasChanges = !!(result && result.changes && result.changes.length > 0);

  return (
    <section className="glass panel" aria-label={t("result.aria")}>
      <div className="panel-head">
        <span className="panel-title"><Icon name="wand" size={15} />{t("result.title", { mode: t(`mode.${mode}` as MsgKey) })}</span>
        <div className="panel-head-right">
          {status === "done" && result ? <span className="chip dim">{elapsed}</span> : null}
        </div>
      </div>
      <div className="panel-body">
        {status === "idle" ? (
          <div className="empty-state">
            <span className="empty-icon"><Icon name="wand" size={26} /></span>
            <span className="empty-title">{t("result.empty.title")}</span>
            <span className="empty-sub">{t("result.empty.sub")}</span>
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
                <button className="chip accent clickable" onClick={props.onCycleDirection} title={t("result.dir.title")}>
                  <Icon name="swap" size={12} />
                  {props.direction === "auto"
                    ? t(result.direction === "zh2en" ? "result.dir.auto.zh2en" : "result.dir.auto.en2zh")
                    : props.direction === "zh2en" ? t("result.dir.locked.zh2en") : t("result.dir.locked.en2zh")}
                </button>
              ) : null}
              {mode === "polish" ? (
                <span className="chip accent"><Icon name="wand" size={12} />{t("result.style", { style: t(`style.${props.style}` as MsgKey) })}</span>
              ) : null}
              {mode !== "translate" && hasChanges ? <span className="chip ok">{t("result.changes", { n: result.changes!.length })}</span> : null}
              {props.fromHistory ? (
                <span className="chip dim" style={{ marginLeft: 8 }}>
                  <Icon name="history" size={11} />
                  {t("result.history.hit")}
                  <button
                    className="btn ghost small"
                    style={{ marginLeft: 4, height: 20, padding: "0 8px", fontSize: 10.5 }}
                    onClick={props.onRerun}
                    title={t("result.rerun.title")}
                  >{t("result.rerun")}</button>
                </span>
              ) : null}
            </div>

            {mode === "polish" ? (
              <div className="style-row">
                {STYLES.map((id) => (
                  <button
                    key={id}
                    className={"style-chip" + (props.style === id ? " sel" : "")}
                    onClick={() => (id === "custom" ? props.onEditCustom() : props.onStyle(id))}
                  >{t(`style.${id}` as MsgKey)}</button>
                ))}
              </div>
            ) : null}

            {mode === "grammar" && hasChanges ? (
              <DiffText corrected={result.result} changes={result.changes!} />
            ) : (
              <div className="result-text">{result.result}</div>
            )}

            {mode === "grammar" && hasChanges ? <ChangesList changes={result.changes!} /> : null}
            {mode === "grammar" ? (
              <div className="changes" style={{ marginTop: 14 }}>
                <div className="changes-title">
                  {t("natural.title")}
                  {props.naturalState === "done" ? (
                    <button className="btn small" onClick={props.onCopyNatural}>
                      <Icon name="copy" size={12} />{t("natural.copy")}
                    </button>
                  ) : (
                    <button className="btn small" onClick={props.onNatural} disabled={props.naturalState === "loading"}>
                      <Icon name="wand" size={12} />{props.naturalState === "loading" ? t("natural.loading") : t("natural.run")}
                    </button>
                  )}
                </div>
                <div className="set-desc" style={{ marginBottom: 8 }}>{t("natural.desc")}</div>
                {props.naturalState === "error" ? (
                  <div className="copy-fail"><Icon name="alert" size={13} />{t("natural.error")}</div>
                ) : null}
                {props.naturalState === "done" && props.natural ? (
                  <>
                    <div className="result-text">{props.natural.text}</div>
                    {props.natural.changes && props.natural.changes.length ? <ChangesList changes={props.natural.changes} /> : null}
                  </>
                ) : null}
              </div>
            ) : null}
            {mode === "polish" && hasChanges ? (
              <div className="changes">
                <div className="changes-title">
                  {t("result.changes.title", { n: result.changes!.length })}
                  <button className="btn ghost small changes-toggle" onClick={onToggleChanges}>
                    <Icon name={showChanges ? "chevron" : "eye"} size={13} />{showChanges ? t("result.collapse") : t("result.showChanges")}
                  </button>
                </div>
                {showChanges ? <ChangesList changes={result.changes!} /> : null}
              </div>
            ) : null}
            {mode === "translate" ? (() => {
              const srcLang = props.result?.detectedLang === "zh" ? "zh" : "en";
              const midLang = srcLang === "zh" ? t("settings.uiLang.en") : t("settings.uiLang.zh");
              const backLang = srcLang === "zh" ? t("settings.uiLang.zh") : t("settings.uiLang.en");
              return (
                <div className="changes" style={{ marginTop: 14 }}>
                  <div className="changes-title">
                    {t("reverse.title")}
                    <span className="chip dim" style={{ marginLeft: 8 }}>{t(srcLang === "zh" ? "reverse.path.zh" : "reverse.path.en")}</span>
                    {props.reverseState === "done" ? (
                      <button className="btn small" onClick={props.onCopyReverse}><Icon name="copy" size={12} />{t("reverse.copy")}</button>
                    ) : (
                      <button className="btn small" onClick={props.onReverse} disabled={props.reverseState === "loading"}>
                        <Icon name="swap" size={12} />{props.reverseState === "loading" ? t("reverse.loading") : t("reverse.run")}
                      </button>
                    )}
                  </div>
                  <div className="set-desc" style={{ marginBottom: 8 }}>{t("reverse.desc")}</div>
                  {props.reverseState === "error" ? (
                    <div className="copy-fail"><Icon name="alert" size={13} />{t("reverse.error")}</div>
                  ) : null}
                  {props.reverseState === "done" && props.reverse ? (
                    <>
                      <div className="set-desc" style={{ marginTop: 6 }}>{t("reverse.intermediate", { lang: midLang })}</div>
                      <div className="result-text">{props.reverse.intermediate}</div>
                      <div className="set-desc" style={{ marginTop: 8 }}>{t("reverse.final", { lang: backLang })}</div>
                      <div className="result-text">{props.reverse.back}</div>
                    </>
                  ) : null}
                </div>
              );
            })() : null}
          </div>
        ) : null}
      </div>
      <div className="panel-foot">
        {status === "done" && result ? (
          <>
            {copied === "auto" ? <span className="copy-ok"><Icon name="check" size={13} />{t("result.copied.auto")}</span> : null}
            {copied === "manual" ? <span className="copy-ok"><Icon name="check" size={13} />{t("result.copied.manual")}</span> : null}
            {copied === "failed" ? <span className="copy-fail"><Icon name="alert" size={13} />{t("result.copied.failed")}</span> : null}
            {copied === "pending" ? <span className="copy-ok"><Icon name="check" size={13} />{t("result.copied.pending")}</span> : null}
            {copied === null ? <span style={{ opacity: 0.75 }}>{t("result.ready")}</span> : null}
            <div className="spacer" />
            {hasChanges ? <button className="btn small" onClick={props.onCopyNotes}><Icon name="copy" size={12} />{t("result.copyNotes")}</button> : null}
            <button className="btn accent small" onClick={props.onCopyResult}><Icon name="copy" size={12} />{t("result.copyResult")}</button>
          </>
        ) : (
          <span style={{ opacity: 0.75 }}>{t("result.aiFooter", { model: props.modelLabel })}</span>
        )}
      </div>
    </section>
  );
}
