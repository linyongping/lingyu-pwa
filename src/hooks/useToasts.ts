import { useCallback, useRef, useState } from "react";

export interface Toast {
  id: number;
  kind: "ok" | "warn" | "err" | "accent";
  text: string;
  action?: { label: string; onClick: () => void };
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const pushToast = useCallback((kind: Toast["kind"], text: string, action?: Toast["action"]) => {
    const id = ++seq.current;
    setToasts((ts) => [...ts.slice(-3), { id, kind, text, action }]);
    window.setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 4000);
  }, []);

  return { toasts, pushToast };
}
