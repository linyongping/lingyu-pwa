import { useCallback, useRef, useState } from "react";

export interface Toast {
  id: number;
  kind: "ok" | "warn" | "err" | "accent";
  text: string;
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const pushToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++seq.current;
    setToasts((ts) => [...ts.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 3400);
  }, []);

  return { toasts, pushToast };
}
