import { Icon } from "./Icon";
import { CHAR_MAX } from "../lib/types";
import type { Mode } from "../lib/types";
import { useI18n, type MsgKey } from "../lib/i18n";

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
  const { t } = useI18n();
  const over = source.length > CHAR_MAX;
  const runLabel = t(`action.${mode}` as MsgKey);
  return (
    <section className="glass panel" aria-label={t("source.aria")}>
      <div className="panel-head">
        <span className="panel-title"><Icon name="clipboard" size={15} />{t("source.title")}</span>
        <div className="panel-head-right">
          {source ? (
            <button className="btn ghost small" onClick={onClear} disabled={busy}><Icon name="x" size={13} />{t("source.clear")}</button>
          ) : null}
        </div>
      </div>
      <div className="panel-body" style={{ display: "flex" }}>
        <textarea
          className="src-textarea"
          placeholder={t("source.placeholder")}
          value={source}
          onChange={(e) => onSource(e.target.value)}
          spellCheck={false}
        />
        {!source ? (
          <div className="empty-state">
            <span className="empty-icon"><Icon name="clipboard" size={26} /></span>
            <span className="empty-title">{t("source.empty.title")}</span>
            <span className="empty-sub">{t("source.empty.sub")}</span>
            <div className="kbd-hints">
              <span><kbd>⌘V</kbd>{t("source.kbd.paste")}</span>
              <span><kbd>⌘⏎</kbd>{t("source.kbd.run")}</span>
            </div>
          </div>
        ) : null}
      </div>
      <div className="panel-foot">
        <span className={"char-count" + (over ? " over" : "")}>{source.length.toLocaleString()} / {CHAR_MAX.toLocaleString()}</span>
        <div className="spacer" />
        <button className="btn small" onClick={onPaste} disabled={busy}><Icon name="clipboardPaste" size={13} />{t("source.paste")}</button>
        <button className="btn accent small" onClick={onRun} disabled={busy || !source.trim() || over}>
          <Icon name="play" size={12} />{runLabel}
        </button>
      </div>
    </section>
  );
}
