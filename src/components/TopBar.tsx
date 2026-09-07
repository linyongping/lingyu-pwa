import { Icon } from "./Icon";
import { MODE_LABELS, MODEL_INFO } from "../lib/types";
import type { Mode, ModelId, Usage } from "../lib/types";

interface Props {
  mode: Mode;
  onMode: (m: Mode) => void;
  clipState: "on" | "denied" | "off";
  usage: Usage | null;
  currentModel: ModelId;
  onHistory: () => void;
  onSettings: () => void;
  onToggleTheme: () => void;
  resolvedTheme: "dark" | "light";
}

export function TopBar({ mode, onMode, clipState, usage, currentModel, onHistory, onSettings, onToggleTheme, resolvedTheme }: Props) {
  const clipText = clipState === "denied" ? "剪贴板 · 需要授权" : clipState === "off" ? "自动读取 关" : "剪贴板监听中";
  const usageClass = usage ? (usage.used >= usage.limit ? " err" : usage.used >= usage.limit * 0.9 ? " warn" : "") : "";
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark"><Icon name="translate" size={17} /></span>
        <span className="brand-name">邻语 <span style={{ opacity: 0.55 }}>Lingyu</span></span>
      </div>
      <nav className="mode-tabs" aria-label="处理模式">
        <button className={"mode-tab" + (mode === "translate" ? " active" : "")} onClick={() => onMode("translate")}>
          <Icon name="translate" size={15} />翻译
        </button>
        <button className={"mode-tab" + (mode === "grammar" ? " active" : "")} onClick={() => onMode("grammar")}>
          <Icon name="spellcheck" size={15} />语法检查
        </button>
        <button className={"mode-tab" + (mode === "polish" ? " active" : "")} onClick={() => onMode("polish")}>
          <Icon name="wand" size={15} />润色
        </button>
      </nav>
      <div className="spacer" />
      <span className={"pill clip-pill " + clipState}>
        <span className="clip-dot" />{clipText}
      </span>
      <span className={"pill" + usageClass} title={`模型: ${MODEL_INFO[currentModel]?.name ?? currentModel} · 每次约 ${MODEL_INFO[currentModel]?.neurons ?? "?"} 神经元`}>
        <Icon name="zap" size={12} />
        {usage ? `AI ${usage.used}/${usage.limit}` : "AI —"}
        <span style={{ opacity: 0.5, marginLeft: 4, fontSize: 10 }}>≈{MODEL_INFO[currentModel]?.neurons ?? "?"}n</span>
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
  return MODEL_INFO[model]?.name ?? model;
}

export function modeTitle(mode: Mode): string {
  return MODE_LABELS[mode];
}
