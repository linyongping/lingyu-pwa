import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { modelLabel, TopBar } from "./components/TopBar";
import { SourcePanel } from "./components/SourcePanel";
import { ResultPanel } from "./components/ResultPanel";
import { CustomStyleModal, HistoryDrawer, LockScreen, OnboardingModal, PromptManagerModal, SettingsDrawer } from "./components/Drawers";
import { Toaster } from "./components/Toaster";
import { useTheme } from "./hooks/useTheme";
import type { ThemePref } from "./hooks/useTheme";
import { useToasts } from "./hooks/useToasts";
import { ApiError, fetchUsage, processText } from "./lib/api";
import { detectLang as lyDetectLang, isSkippable, readClipboard, writeClipboard } from "./lib/clipboard";
import { addHistory, clearHistory, deleteHistory, historyMatches, listHistory } from "./lib/history";
import { loadCustomPrompts, saveCustomPrompts, type PromptKey } from "./lib/prompts";
import { storage } from "./lib/storage";
import { APP_BUILD_ID, APP_BUILT_AT, activateUpdate, fetchDeployedBuild, formatBuiltAt } from "./lib/version";
import { I18nContext, translate, type MsgKey, type TVars } from "./lib/i18n";
import { DEDUPE_WINDOW } from "./lib/types";
import type { ChangeItem, Direction, HistoryItem, Mode, ProcessOk, Settings, StyleId, Usage } from "./lib/types";

type Auth = "checking" | "ok" | "locked";
type Status = "idle" | "processing" | "done" | "error";
type Copied = "auto" | "manual" | "failed" | "pending" | null;

export default function App() {
  const [auth, setAuth] = useState<Auth>("checking");
  const [passcodeInput, setPasscodeInput] = useState("");
  const [lockShake, setLockShake] = useState(false);

  const [themePref, setThemePref] = useState<ThemePref>(() => storage.getTheme());
  const resolvedTheme = useTheme(themePref);

  const [mode, setMode] = useState<Mode>(() => storage.getMode());
  const [source, setSource] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ProcessOk | null>(null);
  const [error, setError] = useState<{ title: string; desc: string } | null>(null);
  const [elapsed, setElapsed] = useState("");
  const [copied, setCopied] = useState<Copied>(null);

  const [direction, setDirection] = useState<Direction>("auto");
  const [style, setStyle] = useState<StyleId>("formal");
  const [customStyle, setCustomStyle] = useState(() => storage.getCustomStyle());
  const [showChanges, setShowChanges] = useState(false);

  const [settings, setSettings] = useState<Settings>(() => storage.getSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [hFilter, setHFilter] = useState<"all" | Mode>("all");
  const [showOnboard, setShowOnboard] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [customPrompts, setCustomPrompts] = useState<Partial<Record<PromptKey, string>>>(loadCustomPrompts);

  const [usage, setUsage] = useState<Usage | null>(null);
  const [clipState, setClipState] = useState<"on" | "denied" | "off">("on");
  const [outdated, setOutdated] = useState(false);
  // 语法检查结果上的「更地道表达」：仅手动触发，不写回剪贴板、不进历史
  const [natural, setNatural] = useState<{ text: string; changes: ChangeItem[] | null } | null>(null);
  const [naturalState, setNaturalState] = useState<"idle" | "loading" | "done" | "error">("idle");
  // 翻译结果上的「反转翻译」：中→英→中（英文源则英→中→英），仅手动触发
  const [reverse, setReverse] = useState<{ intermediate: string; back: string } | null>(null);
  const [reverseState, setReverseState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const { toasts, pushToast } = useToasts();

  /* ── 界面语言 ────────────────────────── */
  // tr 标识稳定、内部读 ref，避免各 useCallback 频繁重建；lang 变化只用于触发子组件重渲染
  const uiLangRef = useRef(settings.uiLang);
  uiLangRef.current = settings.uiLang;
  const tr = useCallback((key: MsgKey, vars?: TVars) => translate(uiLangRef.current, key, vars), []);
  const i18nValue = useMemo(() => ({ lang: settings.uiLang, t: tr }), [settings.uiLang, tr]);
  const modeLabel = useCallback((m: Mode) => tr(`mode.${m}` as MsgKey), [tr]);

  /* refs 镜像，避免异步回调读到过期闭包 */
  const modeRef = useRef(mode); modeRef.current = mode;
  const styleRef = useRef(style); styleRef.current = style;
  const directionRef = useRef(direction); directionRef.current = direction;
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const authRef = useRef(auth); authRef.current = auth;
  const passcodeRef = useRef(""); // 与 storage 同步，供 API 调用
  const busyRef = useRef(false);
  const lastAutoRef = useRef<{ text: string; mode: Mode; at: number; result: string }>({ text: "", mode: "translate", at: 0, result: "" });
  const lastSourceRef = useRef("");
  const pendingWriteRef = useRef<string | null>(null);
  const runSigRef = useRef("");
  const clipWarnedRef = useRef(false);
  const focusReadRef = useRef(false); // 串行化剪贴板自动读取，避免 focus/visibilitychange 并发重复请求
  const fromHistoryRef = useRef(false);
  const userEditRef = useRef(false); // 原文框被手动编辑，避免每次输入都触发 API
  const abortRef = useRef<AbortController | null>(null);
  const textParamActiveRef = useRef(false);
  const customPromptsRef = useRef(customPrompts);
  customPromptsRef.current = customPrompts;
  const historyRef = useRef(history);
  historyRef.current = history;
  const usageRef = useRef(usage);
  usageRef.current = usage;

  useEffect(() => { storage.setSettings(settings); }, [settings]);
  useEffect(() => { storage.setMode(mode); }, [mode]);
  useEffect(() => { storage.setTheme(themePref); }, [themePref]);
  useEffect(() => { storage.setCustomStyle(customStyle); }, [customStyle]);
  useEffect(() => { saveCustomPrompts(customPrompts); }, [customPrompts]);

  /* ── 版本检查：当前构建标识 vs 线上 /version.json ───────── */
  const lastVersionCheckRef = useRef(0);
  const checkVersion = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastVersionCheckRef.current < 60_000) return;
    lastVersionCheckRef.current = now;
    const remote = await fetchDeployedBuild();
    if (remote?.id) setOutdated(remote.id !== APP_BUILD_ID);
  }, []);

  useEffect(() => {
    void checkVersion();
    const onVisible = () => { if (document.visibilityState === "visible") void checkVersion(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [checkVersion]);

  /* 界面语言变化时同步 <html lang> 与标题 */
  useEffect(() => {
    document.documentElement.setAttribute("lang", settings.uiLang === "zh" ? "zh-CN" : "en");
    document.title = tr("app.title");
  }, [settings.uiLang, tr]);

  /* ── 历史缓存命中 ─────────────────────── */
  const tryLoadFromHistory = async (text: string, mode: Mode): Promise<ProcessOk | null> => {
    const t = text.trim();
    const matchNow = (items: HistoryItem[]) =>
      items.find((item) => historyMatches(item, t, mode, styleRef.current, directionRef.current));
    // 先查内存 ref（快速路径）
    let match = matchNow(historyRef.current);
    // ref 为空时（页面刚重新加载、IndexedDB 还没加载完）做一次异步兜底
    if (!match) {
      const fresh = await listHistory();
      match = matchNow(fresh);
    }
    if (!match) return null;
    return {
      result: match.result,
      changes: match.changes,
      detectedLang: lyDetectLang(t),
      direction: match.direction ?? null,
      model: settingsRef.current.model,
      neuronEstimate: 0,
      usage: usageRef.current ?? { used: 0, limit: 3000, date: "" },
    };
  };

  /* ── 复制与补写 ─────────────────────── */
  const copyNow = useCallback(async (text: string) => {
    const ok = await writeClipboard(text);
    setCopied(ok ? "manual" : "failed");
  }, []);

  const deliverResult = useCallback((r: ProcessOk) => {
    if (!settingsRef.current.autoCopy) return;
    if (document.hasFocus()) {
      void writeClipboard(r.result).then((ok) => setCopied(ok ? "auto" : "failed"));
    } else {
      pendingWriteRef.current = r.result;
      setCopied("pending");
    }
  }, []);

  /* ── 核心处理 ───────────────────────── */
  const runProcess = useCallback(async (modeArg: Mode, textArg: string) => {
    const t = textArg.trim();
    if (!t) { pushToast("warn", tr("toast.noContent")); return; }
    if (t.length > 4000) {
      setError({ title: tr("err.tooLong.title"), desc: tr("err.tooLong.desc", { n: t.length.toLocaleString() }) });
      setStatus("error"); setResult(null); setCopied(null);
      return;
    }

    setError(null); setCopied(null); setResult(null); setStatus("processing");
    // 取消上一个进行中的请求（允许模式切换时无缝衔接）
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const started = performance.now();
    busyRef.current = true;
    try {
      const resp = await processText({
        passcode: passcodeRef.current,
        mode: modeArg,
        text: t,
        direction: directionRef.current,
        style: styleRef.current,
        customPrompt: styleRef.current === "custom" ? customStyle : "",
        // 仅当用户自定义过提示词时才下发覆盖；否则交给 worker 生成默认提示词，
        // 这样润色的风格指令/说明语言才会按选择生效（默认润色提示词含占位符）
        systemPrompt: (() => {
          const custom = customPromptsRef.current;
          if (modeArg === "translate") {
            const dir = directionRef.current === "zh2en" || directionRef.current === "en2zh"
              ? directionRef.current
              : lyDetectLang(t) === "zh" ? "zh2en" : "en2zh";
            return custom[dir === "zh2en" ? "translate_zh2en" : "translate_en2zh"];
          }
          if (modeArg === "grammar") return custom.grammar;
          return custom.polish;
        })(),
        explainLang: settingsRef.current.explainLang,
        model: settingsRef.current.model,
      }, controller.signal);
      const used = ((performance.now() - started) / 1000).toFixed(1) + "s";
      setElapsed(used);
      setResult(resp);
      setUsage(resp.usage);
      setStatus("done");
      setNatural(null);
      setNaturalState("idle");
      setReverse(null);
      setReverseState("idle");
      runSigRef.current = [modeArg, styleRef.current, directionRef.current, t].join("|");
      lastSourceRef.current = t;
      fromHistoryRef.current = false;
      // 所有成功请求都记录，避免手动处理的结果写回剪贴板后，下次聚焦又被当成新内容处理（乒乓）
      lastAutoRef.current = { text: t, mode: modeArg, at: Date.now(), result: resp.result };
      void addHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: Date.now(),
        mode: modeArg,
        source: t,
        result: resp.result,
        changes: resp.changes,
        styleLabel: modeArg === "polish" ? styleRef.current : null,
        direction: resp.direction,
      }).then(() => listHistory()).then(setHistory);
      deliverResult(resp);
    } catch (e: any) {
      // 已被更新的请求取代（processText 会把 AbortError 包成 ApiError）：
      // 静默退出，避免旧请求的「超时」错误覆盖新请求的状态
      if (abortRef.current !== controller) return;
      if (e instanceof ApiError) {
        if (e.code === "invalid_passcode") {
          setAuth("locked");
          pushToast("err", tr("toast.passcodeInvalid"));
        } else if (e.code === "too_long") {
          setError({ title: tr("err.tooLong.title"), desc: tr("err.tooLong.desc", { n: t.length.toLocaleString() }) });
          setStatus("error");
        } else if (e.code === "quota_exceeded") {
          setError({ title: tr("err.quota.title"), desc: tr("err.quota.desc") });
          setStatus("error");
        } else if (e.code === "timeout") {
          setError({ title: tr("err.timeout.title"), desc: tr("err.timeout.desc") });
          setStatus("error");
        } else if (e.code === "network") {
          setError({ title: tr("err.fail.title"), desc: tr("err.network.desc") });
          setStatus("error");
        } else if (e.code === "empty_text") {
          setError({ title: tr("err.fail.title"), desc: tr("err.empty.desc") });
          setStatus("error");
        } else if (e.code === "ai_error") {
          setError({ title: tr("err.fail.title"), desc: tr("err.ai.desc") });
          setStatus("error");
        } else if (e.code === "bad_output") {
          setError({ title: tr("err.fail.title"), desc: tr("err.badOutput.desc") });
          setStatus("error");
        } else {
          setError({ title: tr("err.fail.title"), desc: tr("err.fail.unknown") });
          setStatus("error");
        }
      } else {
        setError({ title: tr("err.fail.title"), desc: tr("err.fail.unknown") });
        setStatus("error");
      }
      return;
    } finally {
      clearTimeout(timeoutId);
      // 只有当前请求仍是最新请求时才清 busy，避免旧请求清掉新请求的忙状态
      if (abortRef.current === controller) busyRef.current = false;
    }
  }, [customStyle, deliverResult, pushToast]);

  /* ── 更地道的英文表达（语法检查结果上的手动动作）── */
  const runNatural = useCallback(async () => {
    const base = (result?.result ?? source).trim();
    if (!base) return;
    setNaturalState("loading");
    busyRef.current = true;
    try {
      const resp = await processText({
        passcode: passcodeRef.current,
        mode: "natural",
        text: base,
        direction: "auto",
        style: styleRef.current,
        customPrompt: "",
        explainLang: settingsRef.current.explainLang,
        model: settingsRef.current.model,
      });
      setNatural({ text: resp.result, changes: resp.changes });
      setNaturalState("done");
      setUsage(resp.usage);
    } catch (e) {
      if (e instanceof ApiError && e.code === "invalid_passcode") {
        setAuth("locked");
        pushToast("err", tr("toast.passcodeInvalid"));
      }
      setNaturalState("error");
    } finally {
      busyRef.current = false;
    }
  }, [result, source, pushToast, tr]);

  const resetDerived = useCallback(() => {
    setNatural(null);
    setNaturalState("idle");
    setReverse(null);
    setReverseState("idle");
  }, []);

  /* ── 反转翻译：中→英→中（英文源则英→中→英），手动触发 ── */
  const runReverse = useCallback(async () => {
    const src = (source || result?.result || "").trim();
    if (!src) return;
    const first: "zh2en" | "en2zh" = lyDetectLang(src) === "zh" ? "zh2en" : "en2zh";
    const second: "zh2en" | "en2zh" = first === "zh2en" ? "en2zh" : "zh2en";
    setReverseState("loading");
    busyRef.current = true;
    try {
      const common = {
        passcode: passcodeRef.current,
        mode: "translate" as const,
        style: styleRef.current,
        customPrompt: "",
        explainLang: settingsRef.current.explainLang,
        model: settingsRef.current.model,
      };
      const step1 = await processText({ ...common, text: src, direction: first });
      const step2 = await processText({ ...common, text: step1.result, direction: second });
      setReverse({ intermediate: step1.result, back: step2.result });
      setReverseState("done");
      setUsage(step2.usage);
    } catch (e) {
      if (e instanceof ApiError && e.code === "invalid_passcode") {
        setAuth("locked");
        pushToast("err", tr("toast.passcodeInvalid"));
      }
      setReverseState("error");
    } finally {
      busyRef.current = false;
    }
  }, [source, result, pushToast, tr]);

  /* 模式 / 风格 / 方向变化时按新参数重跑 */
  useEffect(() => {
    if (auth !== "ok" || busyRef.current || status !== "done" || !source.trim()) return;
    // 原文框被手动编辑：只更新界面，不自动调用 API（否则每次输入都会发请求）
    if (userEditRef.current) { userEditRef.current = false; return; }
    const sig = [mode, style, direction, source.trim()].join("|");
    if (sig === runSigRef.current) return;
    // 同步快速路径：historyRef 已填充时直接命中，无需 await
    const t = source.trim();
    const quickMatch = historyRef.current.find((item) => historyMatches(item, t, mode, style, direction));
    if (quickMatch) {
      setResult({
        result: quickMatch.result, changes: quickMatch.changes, detectedLang: lyDetectLang(t),
        direction: quickMatch.direction ?? null, model: settingsRef.current.model, neuronEstimate: 0,
        usage: usageRef.current ?? { used: 0, limit: 3000, date: "" },
      });
      setStatus("done"); setError(null); setCopied(null);
      runSigRef.current = sig; fromHistoryRef.current = true;
      pushToast("accent", tr("toast.history"), { label: tr("toast.history.rerun"), onClick: () => { fromHistoryRef.current = false; void runProcess(modeRef.current, source); } });
      return;
    }
    // 异步兜底：ref 为空时（页面刚重新加载、IndexedDB 还没加载完）
    void (async () => {
      const cached = await tryLoadFromHistory(source, mode);
      if (cached) {
        setResult(cached); setStatus("done"); setError(null); setCopied(null);
        runSigRef.current = sig; fromHistoryRef.current = true;
        pushToast("accent", tr("toast.history"), { label: tr("toast.history.rerun"), onClick: () => { fromHistoryRef.current = false; void runProcess(modeRef.current, source); } });
        return;
      }
      void runProcess(mode, source);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, style, direction, source, status, auth, customStyle]);

  /* ── 剪贴板自动读取 ──────────────────── */
  const simulateFocusRead = useCallback(async () => {
    if (authRef.current !== "ok" || busyRef.current) return;
    if (focusReadRef.current) return; // focus 与 visibilitychange 会同时触发，串行化避免重复请求
    focusReadRef.current = true;
    try {
      if (textParamActiveRef.current) return; // URL 参数文本模式，暂停剪贴板读取
      if (!settingsRef.current.autoRead) {
        if (!clipWarnedRef.current) pushToast("warn", tr("toast.autoReadOff"));
        clipWarnedRef.current = true;
        return;
      }
      const clip = await readClipboard();
      if (!clip.ok) {
        if (clip.reason === "denied") {
          setClipState("denied");
          if (!clipWarnedRef.current) pushToast("warn", tr("toast.clipDenied"));
        } else if (clip.reason === "unsupported") {
          setClipState("denied");
          if (!clipWarnedRef.current) pushToast("warn", tr("toast.clipUnsupported"));
        } else {
          setClipState("on");
        }
        clipWarnedRef.current = true;
        return;
      }
      clipWarnedRef.current = false;
      setClipState("on");
      const text = clip.value;
      if (isSkippable(text)) {
        pushToast("warn", tr("toast.skippable"));
        return;
      }
      const la = lastAutoRef.current;
      // 防重：剪贴板是上次处理的原文「或其结果」都跳过（不限模式，彻底杜绝乒乓）
      if ((text === la.text || (la.result && text === la.result)) && Date.now() - la.at < DEDUPE_WINDOW) {
        pushToast("accent", tr("toast.dup"), {
          label: tr("toast.dup.force"),
          onClick: () => { fromHistoryRef.current = false; void runProcess(modeRef.current, text); },
        });
        return;
      }
      setSource(text);
      // 历史缓存命中：相同文本+相同模式直接用缓存结果，跳过 API 调用
      const cached = await tryLoadFromHistory(text, modeRef.current);
      if (cached) {
        setResult(cached);
        setStatus("done");
        setError(null);
        setCopied(null);
        runSigRef.current = [modeRef.current, styleRef.current, directionRef.current, text].join("|");
        lastAutoRef.current = { text, mode: modeRef.current, at: Date.now(), result: cached.result };
        fromHistoryRef.current = true;
        pushToast("accent", tr("toast.history"), { label: tr("toast.history.rerun"), onClick: () => { fromHistoryRef.current = false; void runProcess(modeRef.current, source); } });
        return;
      }
      void runProcess(modeRef.current, text);
    } finally {
      focusReadRef.current = false;
    }
  }, [pushToast, runProcess]);

  /* 窗口激活：先补写未落地的结果，再自动读取 */
  const onActivate = useCallback(async () => {
    if (authRef.current !== "ok") return;
    if (pendingWriteRef.current && document.hasFocus()) {
      const pending = pendingWriteRef.current;
      const clip = await readClipboard();
      if (!clip.ok) {
        const ok = await writeClipboard(pending);
        if (ok) {
          pendingWriteRef.current = null;
          setCopied("auto");
          pushToast("ok", tr("toast.pendingWritten"));
        }
      } else if (clip.value === lastSourceRef.current) {
        const ok = await writeClipboard(pending);
        if (ok) {
          pendingWriteRef.current = null;
          setCopied("auto");
          pushToast("ok", tr("toast.pendingWritten"));
        }
      } else {
        pendingWriteRef.current = null;
        pushToast("warn", tr("toast.pendingStale"));
      }
    }
    void simulateFocusRead();
  }, [pushToast, simulateFocusRead]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") void onActivate(); };
    window.addEventListener("focus", onActivate);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onActivate);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [onActivate]);

  /* 页内粘贴兜底（iOS / 任意平台 ⌘V） */
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      if (authRef.current !== "ok") return;
      // e.target 可能是 document（无 closest 方法），必须先确认是 Element
      const target = e.target;
      if (target instanceof Element && target.closest("[data-plain-input]")) return;
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (!text.trim()) return;
      e.preventDefault();
      if (isSkippable(text.trim())) {
        pushToast("warn", tr("toast.skippable"));
        return;
      }
      setSource(text.trim());
      // 历史缓存命中
      const cached = await tryLoadFromHistory(text.trim(), modeRef.current);
      if (cached) {
        setResult(cached); setStatus("done"); setError(null); setCopied(null);
        runSigRef.current = [modeRef.current, styleRef.current, directionRef.current, text.trim()].join("|");
        fromHistoryRef.current = true;
        pushToast("accent", tr("toast.history"), { label: tr("toast.history.rerun"), onClick: () => { fromHistoryRef.current = false; void runProcess(modeRef.current, source); } });
        return;
      }
      void runProcess(modeRef.current, text.trim());
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [pushToast, runProcess]);

  /* ── 认证 ───────────────────────────── */
  const tryUnlock = useCallback(async (passcode: string, silent: boolean): Promise<boolean> => {
    try {
      const u = await fetchUsage(passcode);
      passcodeRef.current = passcode;
      setUsage(u);
      setAuth("ok");
      setHistory(await listHistory());
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.code === "invalid_passcode") {
        setAuth("locked");
        if (!silent) setLockShake(true);
        if (!silent) setTimeout(() => setLockShake(false), 450);
        return false;
      }
      // 网络等错误：允许带着口令进入（离线可用，AI 调用时会再报错）
      passcodeRef.current = passcode;
      setAuth("ok");
      setHistory(await listHistory());
      if (!silent) pushToast("warn", tr("toast.offline"));
      return true;
    }
  }, [pushToast]);

  useEffect(() => {
    const saved = storage.getPasscode();
    if (saved) {
      void tryUnlock(saved, true);
    } else {
      setAuth("locked");
    }
  }, [tryUnlock]);

  const unlock = useCallback(async () => {
    const code = passcodeInput.trim();
    if (!code) { setLockShake(true); setTimeout(() => setLockShake(false), 450); return; }
    const ok = await tryUnlock(code, false);
    if (ok) {
      storage.setPasscode(code);
      setPasscodeInput("");
      if (!storage.getOnboarded()) setShowOnboard(true);
      else setTimeout(() => void simulateFocusRead(), 600);
    }
  }, [passcodeInput, tryUnlock, simulateFocusRead]);

  /* ── URL 参数处理：?mode=xxx&text=xxx ──── */
  useEffect(() => {
    if (auth !== "ok") return;
    const params = new URLSearchParams(window.location.search);
    const paramMode = params.get("mode");
    const paramText = params.get("text");

    // 处理 mode 参数
    if (paramMode && ["translate", "grammar", "polish"].includes(paramMode)) {
      setMode(paramMode as Mode);
    }

    // 处理 text 参数（最高优先级，暂停剪贴板监控）
    if (paramText && paramText.trim()) {
      textParamActiveRef.current = true;
      setSource(paramText.trim());
      const m = paramMode && ["translate", "grammar", "polish"].includes(paramMode)
        ? (paramMode as Mode) : modeRef.current;
      pushToast("accent", tr("toast.urlLoaded"));
      setTimeout(() => void runProcess(m, paramText.trim()), 100);
      // 清除 URL 参数（避免刷新重复处理）
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    // 无 text 参数时正常读取剪贴板
    if (!textParamActiveRef.current) {
      setTimeout(() => void simulateFocusRead(), 600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  const finishOnboard = useCallback(() => {
    setShowOnboard(false);
    storage.setOnboarded();
    setTimeout(() => void simulateFocusRead(), 600);
  }, [simulateFocusRead]);

  /* ── 快捷键 ─────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && authRef.current === "ok" && !busyRef.current) {
        e.preventDefault();
        void runProcess(modeRef.current, source);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "c" && result) {
        e.preventDefault();
        void copyNow(result.result);
      }
      if (e.key === "Escape") {
        setShowSettings(false); setShowHistory(false); setShowCustom(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [source, result, runProcess, copyNow]);

  /* ── 渲染 ───────────────────────────── */
  if (auth !== "ok") {
    return (
      <I18nContext.Provider value={i18nValue}>
        <div className="bg-glow glow-a" />
        <div className="bg-glow glow-b" />
        {auth === "locked" ? (
          <LockScreen passcode={passcodeInput} onPasscode={setPasscodeInput} onUnlock={() => void unlock()} shake={lockShake} buildId={APP_BUILD_ID} />
        ) : (
          <div className="lock-screen"><div className="lock-sub">{tr("toast.verifying")}</div></div>
        )}
        <Toaster items={toasts} />
      </I18nContext.Provider>
    );
  }

  const clipPillState = !settings.autoRead ? "off" : clipState;
  let stripText = tr("status.idle");
  let stripTone = "";
  if (status === "processing") { stripText = tr("status.processing", { mode: modeLabel(mode) }); stripTone = "busy"; }
  else if (status === "error" && error) { stripText = error.title; stripTone = "err"; }
  else if (status === "done") {
    stripText = tr("status.done", { elapsed }) + (copied === "auto" ? tr("status.done.copied") : "");
    stripTone = "ok";
  } else if (source) {
    stripText = tr("status.ready", { mode: modeLabel(mode) });
  }

  return (
    <I18nContext.Provider value={i18nValue}>
    <>
      <div className="bg-glow glow-a" />
      <div className="bg-glow glow-b" />
      <div className="app">
        <TopBar
          mode={mode}
          onMode={(m) => { setMode(m); setShowChanges(false); resetDerived(); }}
          clipState={clipPillState}
          usage={usage}
          currentModel={settings.model}
          onHistory={() => setShowHistory(true)}
          onSettings={() => setShowSettings(true)}
          onToggleTheme={() => setThemePref(resolvedTheme === "dark" ? "light" : "dark")}
          resolvedTheme={resolvedTheme}
        />

        <div className={"status-strip " + stripTone}>
          <span>{stripText}</span>
          <span className="status-hint">{tr("status.hint")}</span>
          <button
            className={"chip clickable ver-chip" + (outdated ? " accent" : " dim")}
            title={outdated
              ? tr("status.ver.outdatedTitle", { id: APP_BUILD_ID })
              : tr("status.ver.title", { id: APP_BUILD_ID, built: APP_BUILT_AT ? tr("status.ver.built", { time: formatBuiltAt(APP_BUILT_AT) }) : "" })}
            onClick={() => { if (outdated) void activateUpdate(); else void checkVersion(true); }}
          >{outdated ? tr("status.ver.outdated") : APP_BUILD_ID}</button>
        </div>

        <main className="workbench">
          <SourcePanel
            mode={mode}
            source={source}
            onSource={(v) => { textParamActiveRef.current = false; userEditRef.current = true; setSource(v); resetDerived(); }}
            busy={status === "processing"}
            onRun={() => void runProcess(mode, source)}
            onPaste={async () => {
              const clip = await readClipboard();
              if (clip.ok) {
                setSource(clip.value);
                pushToast("ok", tr("toast.pasted"));
              } else {
                pushToast("warn", clip.reason === "denied" ? tr("toast.clipUnreadable") : tr("toast.clipEmpty"));
              }
            }}
            onClear={() => { setSource(""); setStatus("idle"); setResult(null); setError(null); setCopied(null); resetDerived(); }}
          />
          <ResultPanel
            mode={mode}
            status={status}
            result={result}
            error={error}
            elapsed={elapsed}
            showChanges={showChanges}
            onToggleChanges={() => setShowChanges(!showChanges)}
            copied={copied}
            onCopyResult={() => result && void copyNow(result.result)}
            onCopyNotes={() => {
              if (!result?.changes?.length) return;
              const notes = result.changes
                .map((c, i) => `${i + 1}. ${c.original} → ${c.revised}\n   ${tr("result.notes.reason")}: ${c.reason}`)
                .join("\n");
              void copyNow(notes);
            }}
            style={style}
            onStyle={(s) => setStyle(s)}
            direction={direction}
            onCycleDirection={() => {
              setDirection(direction === "auto"
                ? (result?.direction === "zh2en" ? "zh2en" : "en2zh")
                : direction === "zh2en" ? "en2zh" : "auto");
            }}
            onEditCustom={() => setShowCustom(true)}
            modelLabel={modelLabel(settings.model)}
            fromHistory={fromHistoryRef.current}
            onRerun={() => { fromHistoryRef.current = false; void runProcess(mode, source); }}
            natural={natural}
            naturalState={naturalState}
            onNatural={() => void runNatural()}
            onCopyNatural={() => natural && void copyNow(natural.text)}
            reverse={reverse}
            reverseState={reverseState}
            onReverse={() => void runReverse()}
            onCopyReverse={() => reverse && void copyNow(reverse.back)}
          />
        </main>

        <HistoryDrawer
          open={showHistory}
          items={history}
          filter={hFilter}
          onFilter={setHFilter}
          onClose={() => setShowHistory(false)}
          onLoad={(it) => {
            setMode(it.mode);
            setSource(it.source);
            userEditRef.current = false;
            fromHistoryRef.current = true;
            setResult({ result: it.result, changes: it.changes, detectedLang: "zh", direction: it.direction ?? null, model: settings.model, neuronEstimate: 0, usage: usage ?? { used: 0, limit: 0, date: "" } });
            setStatus("done");
            setError(null);
            setCopied(null);
            runSigRef.current = [it.mode, styleRef.current, directionRef.current, it.source.trim()].join("|");
            setShowHistory(false);
            resetDerived();
            pushToast("accent", tr("toast.historyLoaded"));
          }}
          onDelete={(id) => { void deleteHistory(id).then(() => listHistory()).then(setHistory); }}
          onClear={() => { void clearHistory().then(() => setHistory([])); pushToast("ok", tr("toast.historyCleared")); }}
        />

        <SettingsDrawer
          open={showSettings}
          settings={settings}
          onSet={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          onClose={() => setShowSettings(false)}
          themePref={themePref}
          onTheme={setThemePref}
          onOpenPrompts={() => setShowPrompts(true)}
          buildId={APP_BUILD_ID}
          builtAtLabel={formatBuiltAt(APP_BUILT_AT)}
          outdated={outdated}
          onCheckUpdate={() => void checkVersion(true)}
          onActivateUpdate={() => void activateUpdate()}
        />

        {showOnboard ? <OnboardingModal onDone={finishOnboard} /> : null}
        {showCustom ? (
          <CustomStyleModal
            value={customStyle}
            onClose={() => setShowCustom(false)}
            onSave={(v) => {
              setCustomStyle(v);
              setStyle("custom");
              setShowCustom(false);
              pushToast("ok", tr("toast.customSaved"));
            }}
          />
        ) : null}
        {showPrompts ? (
          <PromptManagerModal
            prompts={customPrompts}
            onClose={() => setShowPrompts(false)}
            onSave={(p) => { setCustomPrompts(p); setShowPrompts(false); pushToast("ok", tr("toast.promptsSaved")); }}
          />
        ) : null}
      </div>
      <Toaster items={toasts} />
    </>
    </I18nContext.Provider>
  );
}
