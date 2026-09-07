import { useEffect, useState } from "react";

export type ThemePref = "system" | "dark" | "light";

function resolve(pref: ThemePref): "dark" | "light" {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return pref;
}

export function useTheme(pref: ThemePref): "dark" | "light" {
  const [resolved, setResolved] = useState<"dark" | "light">(() => resolve(pref));

  useEffect(() => {
    const apply = () => {
      const next = resolve(pref);
      setResolved(next);
      document.documentElement.setAttribute("data-theme", next);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", next === "dark" ? "#0a0d14" : "#eef0f6");
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [pref]);

  return resolved;
}
