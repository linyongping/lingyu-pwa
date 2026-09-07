import { Icon } from "./Icon";
import type { Toast } from "../hooks/useToasts";

export function Toaster({ items }: { items: Toast[] }) {
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div className={"toast " + t.kind} key={t.id}>
          <Icon name={t.kind === "ok" || t.kind === "accent" ? "check" : "alert"} size={14} />
          <span>{t.text}</span>
          {t.action ? (
            <button className="toast-action" onClick={t.action.onClick}>{t.action.label}</button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
