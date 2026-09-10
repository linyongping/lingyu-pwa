import { Icon } from "./Icon";
import { MODEL_INFO } from "../lib/types";
import type { Mode, ModelId, Usage } from "../lib/types";
import { useI18n } from "../lib/i18n";

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
  const { t } = useI18n();
  const clipText = clipState === "denied" ? t("topbar.clip.denied") : clipState === "off" ? t("topbar.clip.off") : t("topbar.clip.on");
  const usageClass = usage ? (usage.used >= usage.limit ? " err" : usage.used >= usage.limit * 0.9 ? " warn" : "") : "";
  const modelName = MODEL_INFO[currentModel]?.name ?? currentModel;
  const modelNeurons = MODEL_INFO[currentModel]?.neurons ?? "?";
  const usageTitle = [
    t("topbar.usage.title", { model: modelName, n: modelNeurons }),
    usage ? t("usage.requests", { used: usage.used, limit: usage.limit }) : null,
    usage?.tokens
      ? t("usage.tokens", { total: usage.tokens.total, prompt: usage.tokens.prompt, completion: usage.tokens.completion })
      : t("usage.tokens.none"),
    usage?.neurons
      ? t(usage.neurons.estimated ? "usage.neurons.est" : "usage.neurons.real", {
          used: usage.neurons.used,
          limit: usage.neurons.limit,
          left: Math.max(0, usage.neurons.limit - usage.neurons.used),
        })
      : null,
  ].filter(Boolean).join("\n");
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark"><Icon name="translate" size={17} /></span>
        <span className="brand-name">{t("brand")}</span>
      </div>
      <nav className="mode-tabs" aria-label={t("topbar.modes.aria")}>
        <button className={"mode-tab" + (mode === "translate" ? " active" : "")} onClick={() => onMode("translate")}>
          <Icon name="translate" size={15} />{t("mode.translate")}
        </button>
        <button className={"mode-tab" + (mode === "grammar" ? " active" : "")} onClick={() => onMode("grammar")}>
          <Icon name="spellcheck" size={15} />{t("mode.grammar")}
        </button>
        <button className={"mode-tab" + (mode === "polish" ? " active" : "")} onClick={() => onMode("polish")}>
          <Icon name="wand" size={15} />{t("mode.polish")}
        </button>
      </nav>
      <div className="spacer" />
      <span className={"pill clip-pill " + clipState}>
        <span className="clip-dot" />{clipText}
      </span>
      <span className={"pill" + usageClass} title={usageTitle}>
        <Icon name="zap" size={12} />
        {usage ? `AI ${usage.used}/${usage.limit}` : "AI —"}
        <span style={{ opacity: 0.5, marginLeft: 4, fontSize: 10 }}>
          {usage?.tokens ? t("usage.pill.tokens", { total: usage.tokens.total }) : `≈${modelNeurons}n`}
        </span>
      </span>
      <button className="icon-btn" title={t("topbar.history")} aria-label={t("topbar.history")} onClick={onHistory}><Icon name="history" size={17} /></button>
      <button className="icon-btn" title={t("topbar.settings")} aria-label={t("topbar.settings")} onClick={onSettings}><Icon name="settings" size={17} /></button>
      <button className="icon-btn" title={resolvedTheme === "dark" ? t("topbar.theme.toLight") : t("topbar.theme.toDark")} aria-label={t("topbar.theme.aria")} onClick={onToggleTheme}>
        <Icon name={resolvedTheme === "dark" ? "sun" : "moon"} size={16} />
      </button>
    </header>
  );
}

export function modelLabel(model: ModelId): string {
  return MODEL_INFO[model]?.name ?? model;
}
