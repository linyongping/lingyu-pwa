import { Icon } from "./Icon";
import { MODE_LABELS } from "../lib/types";
import type { Mode, ModelId, Usage } from "../lib/types";

interface Props {
  mode: Mode;
  onMode: (m: Mode) => void;
  clipState: "on" | "denied" | "off";
  usage: Usage | null;
  busy: boolean;
  onHistory: () => void;
  onSettings: () => void;
  onToggleTheme: () => void;
  resolvedTheme: "dark" | "light";
}

export function TopBar({ mode, onMode, clipState, usage, busy, onHistory, onSettings, onToggleTheme, resolvedTheme }: Props) {
  const clipText = clipState === "denied" ? "剪贴板 · 需要授权" : clipState === "off" ? "自动读取 关" : "剪贴板监听中";
  const usageClass = usage ? (usage.used >= usage.limit ? " err" : usage.used >= usage.limit * 0.9 ? " warn" : "") : "";
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark"><Icon name="translate" size={17} /></span>
        <span className="brand-name">邻语 <span style={{ opacity: 0.55 }}>Lingyu</span></span>
      </div>
      <nav className="mode-tabs" aria-label="处理模式">
        <button className={"mode-tab" + (mode === "translate" ? " active" : "")} onClick={() => onMode("translate")} disabled={busy}>
          <Icon name="translate" size={15} />翻译
        </button>
        <button className={"mode-tab" + (mode === "grammar" ? " active" : "")} onClick={() => onMode("grammar")} disabled={busy}>
          <Icon name="spellcheck" size={15} />语法检查
        </button>
        <button className={"mode-tab" + (mode === "polish" ? " active" : "")} onClick={() => onMode("polish")} disabled={busy}>
          <Icon name="wand" size={15} />润色
        </button>
      </nav>
      <div className="spacer" />
      <span className={"pill clip-pill " + clipState}>
        <span className="clip-dot" />{clipText}
      </span>
      <span className={"pill" + usageClass}>
        <Icon name="zap" size={12} />
        {usage ? `AI 用量 ${usage.used} / ${usage.limit}` : "AI 用量 —"}
      </span>
      <button className="icon-btn" title="历史记录" aria-label="历史记录" onClick={onHistory}><Icon name="history" size={17} /></button>
      <button className="icon-btn" title="设置" aria-label="设置" onClick={onSettings}><Icon name="settings" size={17} /></button>
      <button className="icon-btn" title={resolvedTheme === "dark" ? "切换浅色" : "切换深色"} aria-label="切换主题" onClick={onToggleTheme}>
        <Icon name={resolvedTheme === "dark" ? "sun" : "moon"} size={16} />
      </button>
    </header>
  );
}

export function modelLabel(model: ModelId): string {
  return model === "qwen3_8" ? "Qwen3.8-27B" : "Qwen3-30B-A3B";
}

export function modeTitle(mode: Mode): string {
  return MODE_LABELS[mode];
}
