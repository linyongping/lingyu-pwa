import type { ModelId, Settings } from "./types";

const KEYS = {
  passcode: "ly_passcode",
  onboarded: "ly_onboarded",
  theme: "ly_theme",
  mode: "ly_mode",
  settings: "ly_settings",
  customStyle: "ly_custom_style",
} as const;

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const storage = {
  getPasscode(): string {
    return localStorage.getItem(KEYS.passcode) ?? "";
  },
  setPasscode(value: string) {
    localStorage.setItem(KEYS.passcode, value);
  },
  getOnboarded(): boolean {
    return localStorage.getItem(KEYS.onboarded) === "1";
  },
  setOnboarded() {
    localStorage.setItem(KEYS.onboarded, "1");
  },
  getTheme(): "system" | "dark" | "light" {
    const v = localStorage.getItem(KEYS.theme);
    return v === "dark" || v === "light" || v === "system" ? v : "dark";
  },
  setTheme(v: "system" | "dark" | "light") {
    localStorage.setItem(KEYS.theme, v);
  },
  getMode(): "translate" | "grammar" | "polish" {
    const v = localStorage.getItem(KEYS.mode);
    return v === "grammar" || v === "polish" || v === "translate" ? v : "translate";
  },
  setMode(v: "translate" | "grammar" | "polish") {
    localStorage.setItem(KEYS.mode, v);
  },
  getSettings(): Settings {
    const defaults: Settings = { autoRead: true, autoCopy: true, model: "qwen3", explainLang: "zh" };
    const saved = loadJSON<unknown>(KEYS.settings, null);
    // localStorage 可能被写坏（"null"、数组、缺字段），逐项校验后再合并，避免 undefined 传播
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return defaults;
    const s = saved as Record<string, unknown>;
    const validModels: ModelId[] = ["qwen3", "qwen3_8", "m2m100", "llama32_1b"];
    return {
      autoRead: typeof s.autoRead === "boolean" ? s.autoRead : defaults.autoRead,
      autoCopy: typeof s.autoCopy === "boolean" ? s.autoCopy : defaults.autoCopy,
      model: validModels.includes(s.model as ModelId) ? (s.model as ModelId) : defaults.model,
      explainLang: s.explainLang === "en" ? "en" : defaults.explainLang,
    };
  },
  setSettings(s: Settings) {
    localStorage.setItem(KEYS.settings, JSON.stringify(s));
  },
  getCustomStyle(): string {
    return localStorage.getItem(KEYS.customStyle) ?? "";
  },
  setCustomStyle(v: string) {
    localStorage.setItem(KEYS.customStyle, v);
  },
};
