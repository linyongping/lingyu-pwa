import { useState } from "react";
import { Icon } from "./Icon";
import { MODEL_INFO, STYLES } from "../lib/types";
import type { HistoryItem, Mode, ModelId, Settings } from "../lib/types";
import { formatTime } from "../lib/diff";
import { DEFAULT_PROMPTS, type PromptKey } from "../lib/prompts";
import type { ThemePref } from "../hooks/useTheme";
import { useI18n, type MsgKey } from "../lib/i18n";

/* ── 抽屉骨架 ─────────────────────────── */
export function Drawer({ open, title, onClose, children, foot }: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  foot?: string;
}) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={title}>
        <div className="drawer-head">
          <span className="drawer-title">{title}</span>
          <div className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label={t("common.close")}><Icon name="x" size={15} /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {foot ? <div className="drawer-foot">{foot}</div> : null}
      </aside>
    </>
  );
}

/* ── 历史 ─────────────────────────────── */
export function HistoryDrawer({ open, items, filter, onFilter, onClose, onLoad, onDelete, onClear }: {
  open: boolean;
  items: HistoryItem[];
  filter: "all" | Mode;
  onFilter: (f: "all" | Mode) => void;
  onClose: () => void;
  onLoad: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const filtered = filter === "all" ? items : items.filter((it) => it.mode === filter);
  const filters: Array<["all" | Mode, string]> = [
    ["all", t("history.filter.all")],
    ["translate", t("mode.translate")],
    ["grammar", t("mode.grammar")],
    ["polish", t("mode.polish")],
  ];
  const styleText = (label: string) => ((STYLES as string[]).includes(label) ? t(`style.${label}` as MsgKey) : label);
  return (
    <Drawer open={open} title={t("history.title")} onClose={onClose} foot={t("history.foot")}>
      <div className="h-filter">
        {filters.map(([id, label]) => (
          <button key={id} className={"style-chip" + (filter === id ? " sel" : "")} onClick={() => onFilter(id)}>{label}</button>
        ))}
        <div className="spacer" />
        {items.length ? <button className="btn ghost small" onClick={onClear}><Icon name="trash" size={13} />{t("history.clear")}</button> : null}
      </div>
      {filtered.length === 0 ? (
        <div className="h-empty">{t("history.empty")}</div>
      ) : (
        filtered.map((it) => (
          <div className="h-item" key={it.id} onClick={() => onLoad(it)}>
            <div className="h-item-main">
              <div className="h-meta">
                <span className={"h-badge " + it.mode}>{t(`mode.${it.mode}` as MsgKey)}</span>
                <span className="h-time">{formatTime(it.time)}</span>
                {it.styleLabel ? <span className="h-time">{styleText(it.styleLabel)}</span> : null}
              </div>
              <div className="h-src">{it.source}</div>
            </div>
            <button className="h-del" aria-label={t("history.delete")} onClick={(e) => { e.stopPropagation(); onDelete(it.id); }}>
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))
      )}
    </Drawer>
  );
}

/* ── 设置 ─────────────────────────────── */
export function SettingsDrawer({ open, settings, onSet, onClose, themePref, onTheme, onOpenPrompts, buildId, builtAtLabel, outdated, onCheckUpdate, onActivateUpdate }: {
  open: boolean;
  settings: Settings;
  onSet: (patch: Partial<Settings>) => void;
  onClose: () => void;
  themePref: ThemePref;
  onTheme: (t: ThemePref) => void;
  onOpenPrompts: () => void;
  buildId: string;
  builtAtLabel: string;
  outdated: boolean;
  onCheckUpdate: () => void;
  onActivateUpdate: () => void;
}) {
  const { t } = useI18n();
  return (
    <Drawer open={open} title={t("settings.title")} onClose={onClose} foot={t("settings.foot")}>
      <div className="set-block">
        <div className="set-block-label">{t("settings.uiLang")}</div>
        <div className="seg">
          <button className={"seg-btn" + (settings.uiLang === "en" ? " active" : "")} onClick={() => onSet({ uiLang: "en" })}>{t("settings.uiLang.en")}</button>
          <button className={"seg-btn" + (settings.uiLang === "zh" ? " active" : "")} onClick={() => onSet({ uiLang: "zh" })}>{t("settings.uiLang.zh")}</button>
        </div>
        <div className="set-desc" style={{ marginTop: 8 }}>{t("settings.uiLang.desc")}</div>
      </div>
      <div className="set-row">
        <div>
          <div className="set-label">{t("settings.autoRead")}</div>
          <div className="set-desc">{t("settings.autoRead.desc")}</div>
        </div>
        <button className={"switch" + (settings.autoRead ? " on" : "")} aria-label={t("settings.autoRead")} onClick={() => onSet({ autoRead: !settings.autoRead })} />
      </div>
      <div className="set-row">
        <div>
          <div className="set-label">{t("settings.autoCopy")}</div>
          <div className="set-desc">{t("settings.autoCopy.desc")}</div>
        </div>
        <button className={"switch" + (settings.autoCopy ? " on" : "")} aria-label={t("settings.autoCopy")} onClick={() => onSet({ autoCopy: !settings.autoCopy })} />
      </div>
      <div className="set-block">
        <div className="set-block-label">{t("settings.explainLang")}</div>
        <div className="seg">
          <button className={"seg-btn" + (settings.explainLang === "zh" ? " active" : "")} onClick={() => onSet({ explainLang: "zh" })}>{t("settings.lang.zh")}</button>
          <button className={"seg-btn" + (settings.explainLang === "en" ? " active" : "")} onClick={() => onSet({ explainLang: "en" })}>{t("settings.lang.en")}</button>
        </div>
      </div>
      <div className="set-block">
        <div className="set-block-label">{t("settings.model")}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            style={{
              flex: 1, height: 36, padding: "0 10px", borderRadius: "var(--radius-sm)",
              background: "var(--bg-elev)", border: "1px solid var(--border)", color: "var(--text)",
              fontFamily: "inherit", fontSize: 13, cursor: "pointer", outline: "none",
            }}
            value={settings.model}
            onChange={(e) => onSet({ model: e.target.value as ModelId })}
          >
            {(Object.keys(MODEL_INFO) as ModelId[]).map((id) => (
              <option key={id} value={id}>
                {t("settings.model.option", { name: MODEL_INFO[id].name, desc: t(`model.${id}.desc` as MsgKey), n: MODEL_INFO[id].neurons })}
              </option>
            ))}
          </select>
          <button
            className="btn small"
            onClick={() => onSet({ model: settings.model })}
            title={t("settings.model.setDefaultTitle")}
          >{t("settings.model.setDefault")}</button>
        </div>
        <div className="set-desc" style={{ marginTop: 8 }}>
          {t("settings.model.current", { name: MODEL_INFO[settings.model]?.name ?? settings.model })}
          {settings.model !== "qwen3" ? t("settings.model.nonDefault") : t("settings.model.default")}
        </div>
      </div>
      <div className="set-block">
        <div className="set-block-label">{t("settings.appearance")}</div>
        <div className="seg">
          <button className={"seg-btn" + (themePref === "dark" ? " active" : "")} onClick={() => onTheme("dark")}>{t("settings.theme.dark")}</button>
          <button className={"seg-btn" + (themePref === "light" ? " active" : "")} onClick={() => onTheme("light")}>{t("settings.theme.light")}</button>
          <button className={"seg-btn" + (themePref === "system" ? " active" : "")} onClick={() => onTheme("system")}>{t("settings.theme.system")}</button>
        </div>
      </div>
      <div className="set-row">
        <div>
          <div className="set-label">{t("settings.prompts")}</div>
          <div className="set-desc">{t("settings.prompts.desc")}</div>
        </div>
        <button className="btn small" onClick={onOpenPrompts}><Icon name="wand" size={13} />{t("settings.edit")}</button>
      </div>
      <div className="set-row">
        <div>
          <div className="set-label">{t("settings.version")}{outdated ? <span style={{ color: "var(--accent)", marginLeft: 6 }}>{t("settings.version.outdated")}</span> : null}</div>
          <div className="set-desc" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
            {buildId}{builtAtLabel ? t("settings.version.built", { time: builtAtLabel }) : ""}
          </div>
        </div>
        {outdated ? (
          <button className="btn accent small" onClick={onActivateUpdate}>{t("settings.update.refresh")}</button>
        ) : (
          <button className="btn small" onClick={onCheckUpdate}>{t("settings.update.check")}</button>
        )}
      </div>
    </Drawer>
  );
}

/* ── 锁屏 ─────────────────────────────── */
export function LockScreen({ passcode, onPasscode, onUnlock, shake, buildId }: {
  passcode: string;
  onPasscode: (v: string) => void;
  onUnlock: () => void;
  shake: boolean;
  buildId?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="lock-screen">
      <div className="lock-card">
        <span className="lock-logo"><Icon name="translate" size={26} /></span>
        <div className="lock-title">{t("lock.title")}</div>
        <div className="lock-sub">{t("lock.sub")}</div>
        <input
          className={"lock-input" + (shake ? " err" : "")}
          type="password"
          inputMode="numeric"
          maxLength={8}
          placeholder="••••••"
          value={passcode}
          onChange={(e) => onPasscode(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onUnlock(); }}
          aria-label={t("lock.aria")}
          autoFocus
        />
        <div className="lock-err">{shake ? t("lock.err") : ""}</div>
        <button className="btn accent lock-btn" onClick={onUnlock}><Icon name="lock" size={15} />{t("lock.unlock")}</button>
        <div className="lock-hint">{t("lock.hint")}</div>
        {buildId ? <div className="lock-version">{buildId}</div> : null}
      </div>
    </div>
  );
}

/* ── 首次引导 ─────────────────────────── */
export function OnboardingModal({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  return (
    <>
      <div className="scrim" style={{ zIndex: 64 }} onClick={onDone} />
      <div className="modal-card" role="dialog" aria-label={t("ob.aria")}>
        <div className="modal-title">{t("ob.title")}</div>
        <div className="modal-sub">{t("ob.sub")}</div>
        <div className="ob-step">
          <span className="ob-no">1</span>
          <div>
            <div className="ob-title">{t("ob.1.title")}</div>
            <div className="ob-desc">{t("ob.1.desc")}</div>
          </div>
        </div>
        <div className="ob-step">
          <span className="ob-no">2</span>
          <div>
            <div className="ob-title">{t("ob.2.title")}</div>
            <div className="ob-desc">{t("ob.2.desc")}</div>
          </div>
        </div>
        <div className="ob-step">
          <span className="ob-no">3</span>
          <div>
            <div className="ob-title">{t("ob.3.title")}</div>
            <div className="ob-desc">{t("ob.3.desc")}</div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn accent" onClick={onDone}>{t("ob.start")}</button>
        </div>
      </div>
    </>
  );
}

/* ── 自定义润色指令 ───────────────────── */
export function CustomStyleModal({ value, onSave, onClose }: {
  value: string;
  onSave: (v: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(value);
  return (
    <>
      <div className="scrim" style={{ zIndex: 64 }} onClick={onClose} />
      <div className="modal-card" role="dialog" aria-label={t("custom.aria")}>
        <div className="modal-title">{t("custom.title")}</div>
        <div className="modal-sub">{t("custom.sub")}</div>
        <textarea
          className="custom-textarea"
          data-plain-input="1"
          autoFocus
          placeholder={t("custom.placeholder")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>{t("custom.cancel")}</button>
          <button className="btn accent" onClick={() => onSave(draft.trim())}>{t("custom.save")}</button>
        </div>
      </div>
    </>
  );
}

/* ── 提示词管理 ───────────────────────── */
export function PromptManagerModal({
  prompts, onSave, onClose,
}: {
  prompts: Partial<Record<PromptKey, string>>;
  onSave: (p: Partial<Record<PromptKey, string>>) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Partial<Record<PromptKey, string>>>({ ...prompts });
  const [active, setActive] = useState<PromptKey>("translate_zh2en");
  const current = draft[active] ?? DEFAULT_PROMPTS[active];
  const isCustomized = active in draft;

  return (
    <>
      <div className="scrim" style={{ zIndex: 64 }} onClick={onClose} />
      <div className="modal-card" role="dialog" aria-label={t("prompts.aria")} style={{ maxWidth: 560 }}>
        <div className="modal-title">{t("prompts.title")}</div>
        <div className="modal-sub">{t("prompts.sub")}</div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {(Object.keys(DEFAULT_PROMPTS) as PromptKey[]).map((key) => (
            <button
              key={key}
              className={"style-chip" + (active === key ? " sel" : "")}
              onClick={() => setActive(key)}
              style={{ fontSize: 11.5 }}
            >
              {t(`prompt.${key}` as MsgKey)}
              {key in draft ? <span style={{ marginLeft: 4, color: "var(--ok)" }}>{t("prompts.edited")}</span> : null}
            </button>
          ))}
        </div>

        <textarea
          className="custom-textarea"
          style={{ minHeight: 180, fontFamily: "var(--font-mono)", fontSize: 12 }}
          value={current}
          onChange={(e) => setDraft((d) => ({ ...d, [active]: e.target.value }))}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, fontSize: 11.5, color: "var(--text-3)" }}>
          <span>{isCustomized ? t("prompts.custom") : t("prompts.default")} · {t("prompts.chars", { n: current.length })}</span>
          {isCustomized ? (
            <button
              className="btn ghost small"
              onClick={() => setDraft((d) => { const n = { ...d }; delete n[active]; return n; })}
            >{t("prompts.restore")}</button>
          ) : null}
        </div>

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>{t("prompts.cancel")}</button>
          <button className="btn accent" onClick={() => onSave(draft)}>{t("prompts.save")}</button>
        </div>
      </div>
    </>
  );
}
