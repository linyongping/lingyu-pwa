import { useState } from "react";
import { Icon } from "./Icon";
import { MODEL_INFO, MODE_LABELS } from "../lib/types";
import type { HistoryItem, Mode, ModelId, Settings } from "../lib/types";
import { formatTime } from "../lib/diff";
import type { ThemePref } from "../hooks/useTheme";

/* ── 抽屉骨架 ─────────────────────────── */
export function Drawer({ open, title, onClose, children, foot }: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  foot?: string;
}) {
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={title}>
        <div className="drawer-head">
          <span className="drawer-title">{title}</span>
          <div className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="关闭"><Icon name="x" size={15} /></button>
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
  const filtered = filter === "all" ? items : items.filter((it) => it.mode === filter);
  return (
    <Drawer open={open} title="历史记录" onClose={onClose} foot="本地 IndexedDB · 最多保留 200 条">
      <div className="h-filter">
        {([["all", "全部"], ["translate", "翻译"], ["grammar", "检查"], ["polish", "润色"]] as Array<["all" | Mode, string]>).map(([id, label]) => (
          <button key={id} className={"style-chip" + (filter === id ? " sel" : "")} onClick={() => onFilter(id)}>{label}</button>
        ))}
        <div className="spacer" />
        {items.length ? <button className="btn ghost small" onClick={onClear}><Icon name="trash" size={13} />清空</button> : null}
      </div>
      {filtered.length === 0 ? (
        <div className="h-empty">还没有处理记录</div>
      ) : (
        filtered.map((it) => (
          <div className="h-item" key={it.id} onClick={() => onLoad(it)}>
            <div className="h-item-main">
              <div className="h-meta">
                <span className={"h-badge " + it.mode}>{MODE_LABELS[it.mode]}</span>
                <span className="h-time">{formatTime(it.time)}</span>
                {it.styleLabel ? <span className="h-time">{it.styleLabel}</span> : null}
              </div>
              <div className="h-src">{it.source}</div>
            </div>
            <button className="h-del" aria-label="删除该条" onClick={(e) => { e.stopPropagation(); onDelete(it.id); }}>
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))
      )}
    </Drawer>
  );
}

/* ── 设置 ─────────────────────────────── */
export function SettingsDrawer({ open, settings, onSet, onClose, themePref, onTheme }: {
  open: boolean;
  settings: Settings;
  onSet: (patch: Partial<Settings>) => void;
  onClose: () => void;
  themePref: ThemePref;
  onTheme: (t: ThemePref) => void;
}) {
  return (
    <Drawer open={open} title="设置" onClose={onClose} foot="访问口令已保存至本机 · 结果与历史不离开你的设备">
      <div className="set-row">
        <div>
          <div className="set-label">剪贴板自动读取</div>
          <div className="set-desc">激活窗口时自动读取并开始处理</div>
        </div>
        <button className={"switch" + (settings.autoRead ? " on" : "")} aria-label="剪贴板自动读取" onClick={() => onSet({ autoRead: !settings.autoRead })} />
      </div>
      <div className="set-row">
        <div>
          <div className="set-label">结果自动复制</div>
          <div className="set-desc">处理完成后自动写回剪贴板</div>
        </div>
        <button className={"switch" + (settings.autoCopy ? " on" : "")} aria-label="结果自动复制" onClick={() => onSet({ autoCopy: !settings.autoCopy })} />
      </div>
      <div className="set-block">
        <div className="set-block-label">说明语言</div>
        <div className="seg">
          <button className={"seg-btn" + (settings.explainLang === "zh" ? " active" : "")} onClick={() => onSet({ explainLang: "zh" })}>中文</button>
          <button className={"seg-btn" + (settings.explainLang === "en" ? " active" : "")} onClick={() => onSet({ explainLang: "en" })}>English</button>
        </div>
      </div>
      <div className="set-block">
        <div className="set-block-label">AI 模型（Workers AI）</div>
        <div className="model-grid">
          {(Object.keys(MODEL_INFO) as ModelId[]).map((id) => {
            const info = MODEL_INFO[id];
            return (
              <button key={id} className={"model-card" + (settings.model === id ? " sel" : "")} onClick={() => onSet({ model: id })}>
                <div className="model-name">{info.name}<span className="model-tag">{info.tag}</span></div>
                <div className="model-desc">{info.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="set-block">
        <div className="set-block-label">外观</div>
        <div className="seg">
          <button className={"seg-btn" + (themePref === "dark" ? " active" : "")} onClick={() => onTheme("dark")}>深色</button>
          <button className={"seg-btn" + (themePref === "light" ? " active" : "")} onClick={() => onTheme("light")}>浅色</button>
          <button className={"seg-btn" + (themePref === "system" ? " active" : "")} onClick={() => onTheme("system")}>跟随系统</button>
        </div>
      </div>
    </Drawer>
  );
}

/* ── 锁屏 ─────────────────────────────── */
export function LockScreen({ passcode, onPasscode, onUnlock, shake }: {
  passcode: string;
  onPasscode: (v: string) => void;
  onUnlock: () => void;
  shake: boolean;
}) {
  return (
    <div className="lock-screen">
      <div className="lock-card">
        <span className="lock-logo"><Icon name="translate" size={26} /></span>
        <div className="lock-title">邻语 Lingyu</div>
        <div className="lock-sub">剪贴板翻译台 · 粘贴即处理</div>
        <input
          className={"lock-input" + (shake ? " err" : "")}
          type="password"
          inputMode="numeric"
          maxLength={8}
          placeholder="••••••"
          value={passcode}
          onChange={(e) => onPasscode(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onUnlock(); }}
          aria-label="访问口令"
          autoFocus
        />
        <div className="lock-err">{shake ? "口令错误，请重试" : ""}</div>
        <button className="btn accent lock-btn" onClick={onUnlock}><Icon name="lock" size={15} />解锁工作台</button>
        <div className="lock-hint">口令保存在本机，向应用所有者获取</div>
      </div>
    </div>
  );
}

/* ── 首次引导 ─────────────────────────── */
export function OnboardingModal({ onDone }: { onDone: () => void }) {
  return (
    <>
      <div className="scrim" style={{ zIndex: 64 }} onClick={onDone} />
      <div className="modal-card" role="dialog" aria-label="使用引导">
        <div className="modal-title">欢迎使用邻语</div>
        <div className="modal-sub">三步完成设置，之后就是「粘贴即结果」</div>
        <div className="ob-step">
          <span className="ob-no">1</span>
          <div>
            <div className="ob-title">允许读取剪贴板</div>
            <div className="ob-desc">浏览器会弹出授权提示，点击「允许」；桌面 Chrome / Edge / Safari 均支持，之后不再询问。</div>
          </div>
        </div>
        <div className="ob-step">
          <span className="ob-no">2</span>
          <div>
            <div className="ob-title">切回即处理</div>
            <div className="ob-desc">从任何文档切回邻语窗口，会自动读取剪贴板里的最新文本，按上次使用的模式开始处理。</div>
          </div>
        </div>
        <div className="ob-step">
          <span className="ob-no">3</span>
          <div>
            <div className="ob-title">结果自动写回</div>
            <div className="ob-desc">处理完成后结果自动复制，切回原文档直接 ⌘V 粘贴；原文始终保留在历史记录中。</div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn accent" onClick={onDone}>开始使用</button>
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
  const [draft, setDraft] = useState(value);
  return (
    <>
      <div className="scrim" style={{ zIndex: 64 }} onClick={onClose} />
      <div className="modal-card" role="dialog" aria-label="自定义润色指令">
        <div className="modal-title">自定义润色指令</div>
        <div className="modal-sub">描述你想要的语气与格式，会作为系统提示词发送给模型。</div>
        <textarea
          className="custom-textarea"
          data-plain-input="1"
          autoFocus
          placeholder="例如：改写成适合技术博客的语气，保留代码块与专有名词，句子尽量短。"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>取消</button>
          <button className="btn accent" onClick={() => onSave(draft.trim())}>保存并使用</button>
        </div>
      </div>
    </>
  );
}
