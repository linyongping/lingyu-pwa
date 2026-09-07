import { useCallback, useEffect, useRef, useState } from "react";
import { modelLabel, TopBar } from "./components/TopBar";
import { SourcePanel } from "./components/SourcePanel";
import { ResultPanel } from "./components/ResultPanel";
import { CustomStyleModal, HistoryDrawer, LockScreen, OnboardingModal, SettingsDrawer } from "./components/Drawers";
import { Toaster } from "./components/Toaster";
import { useTheme } from "./hooks/useTheme";
import type { ThemePref } from "./hooks/useTheme";
import { useToasts } from "./hooks/useToasts";
import { ApiError, fetchUsage, processText } from "./lib/api";
import { detectLang, isSkippable, readClipboard, writeClipboard } from "./lib/clipboard";
import { addHistory, clearHistory, deleteHistory, listHistory } from "./lib/history";
import { storage } from "./lib/storage";
import { DEDUPE_WINDOW, MODE_LABELS, STYLES } from "./lib/types";
import type { Direction, HistoryItem, Mode, ProcessOk, Settings, StyleId, Usage } from "./lib/types";

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

  const [usage, setUsage] = useState<Usage | null>(null);
  const [clipState, setClipState] = useState<"on" | "denied" | "off">("on");

  const { toasts, pushToast } = useToasts();

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
  const fromHistoryRef = useRef(false);
  const historyRef = useRef(history);
  historyRef.current = history;
  const usageRef = useRef(usage);
  usageRef.current = usage;

  useEffect(() => { storage.setSettings(settings); }, [settings]);
  useEffect(() => { storage.setMode(mode); }, [mode]);
  useEffect(() => { storage.setTheme(themePref); }, [themePref]);
  useEffect(() => { storage.setCustomStyle(customStyle); }, [customStyle]);

  /* ── 历史缓存命中 ─────────────────────── */
  const tryLoadFromHistory = (text: string, mode: Mode): ProcessOk | null => {
    const t = text.trim();
    const match = historyRef.current.find((item) => item.source === t && item.mode === mode);
    if (!match) return null;
    return {
      result: match.result,
      changes: match.changes,
      detectedLang: detectLang(t),
      direction: null,
      model: settingsRef.current.model,
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
  const runProcess = useCallback(async (modeArg: Mode, textArg: string, opts?: { auto?: boolean }) => {
    const t = textArg.trim();
    if (!t) { pushToast("warn", "没有可处理的内容"); return; }
    if (t.length > 4000) {
      setError({ title: "文本超过 4,000 字符上限", desc: `当前 ${t.length.toLocaleString()} 字符，请缩短后重试。` });
      setStatus("error"); setResult(null); setCopied(null);
      return;
    }

    setError(null); setCopied(null); setResult(null); setStatus("processing");
    busyRef.current = true;
    const started = performance.now();

    try {
      const resp = await processText({
        passcode: passcodeRef.current,
        mode: modeArg,
        text: t,
        direction: directionRef.current,
        style: styleRef.current,
        customPrompt: styleRef.current === "custom" ? customStyle : "",
        explainLang: settingsRef.current.explainLang,
        model: settingsRef.current.model,
      });
      const used = ((performance.now() - started) / 1000).toFixed(1) + "s";
      setElapsed(used);
      setResult(resp);
      setUsage(resp.usage);
      setStatus("done");
      runSigRef.current = [modeArg, styleRef.current, directionRef.current, t].join("|");
      lastSourceRef.current = t;
      fromHistoryRef.current = false;
      if (opts?.auto) lastAutoRef.current = { text: t, mode: modeArg, at: Date.now(), result: resp.result };
      void addHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: Date.now(),
        mode: modeArg,
        source: t,
        result: resp.result,
        changes: resp.changes,
        styleLabel: modeArg === "polish" ? STYLES.find((s) => s.id === styleRef.current)?.label ?? null : null,
      }).then(() => listHistory()).then(setHistory);
      deliverResult(resp);
    } catch (e) {
      busyRef.current = false;
      if (e instanceof ApiError) {
        if (e.code === "invalid_passcode") {
          setAuth("locked");
          pushToast("err", "口令已失效，请重新输入");
        } else if (e.code === "too_long") {
          setError({ title: "文本超过 4,000 字符上限", desc: e.message });
          setStatus("error");
        } else if (e.code === "quota_exceeded") {
          setError({ title: "今日 AI 请求额度已用尽", desc: "Workers AI 免费额度明日自动恢复；也可在设置中切换轻量模型降低消耗。" });
          setStatus("error");
        } else {
          setError({ title: "处理失败", desc: e.message });
          setStatus("error");
        }
      } else {
        setError({ title: "处理失败", desc: "发生未知错误，请重试。" });
        setStatus("error");
      }
      return;
    } finally {
      busyRef.current = false;
    }
  }, [customStyle, deliverResult, pushToast]);

  /* 模式 / 风格 / 方向变化时按新参数重跑 */
  useEffect(() => {
    if (auth !== "ok" || busyRef.current || status !== "done" || !source.trim()) return;
    const sig = [mode, style, direction, source.trim()].join("|");
    if (sig === runSigRef.current) return;
    // 模式/风格/方向变化时，也先检查历史缓存
    const cached = tryLoadFromHistory(source, mode);
    if (cached) {
      setResult(cached); setStatus("done"); setError(null); setCopied(null);
      runSigRef.current = sig;
      fromHistoryRef.current = true;
      pushToast("accent", "命中历史记录，已跳过 API 调用");
      return;
    }
    void runProcess(mode, source, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, style, direction, source, status, auth]);

  /* ── 剪贴板自动读取 ──────────────────── */
  const simulateFocusRead = useCallback(async () => {
    if (authRef.current !== "ok" || busyRef.current) return;
    if (!settingsRef.current.autoRead) {
      if (!clipWarnedRef.current) pushToast("warn", "自动读取已关闭（设置中可开启）");
      clipWarnedRef.current = true;
      return;
    }
    const clip = await readClipboard();
    if (!clip.ok) {
      if (clip.reason === "denied") {
        setClipState("denied");
        if (!clipWarnedRef.current) pushToast("warn", "未获得剪贴板权限——请在浏览器地址栏授权后重试");
      } else if (clip.reason === "unsupported") {
        setClipState("denied");
        if (!clipWarnedRef.current) pushToast("warn", "此浏览器不支持自动读取，请直接 ⌘V 粘贴");
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
      pushToast("warn", "剪贴板是链接或内容过短，已跳过自动处理");
      return;
    }
    const la = lastAutoRef.current;
    // 防重：剪贴板是上次处理的原文「或其结果」都跳过，避免结果写回后被再次处理来回乒乓
    if ((text === la.text || (la.result && text === la.result)) && modeRef.current === la.mode && Date.now() - la.at < DEDUPE_WINDOW) {
      pushToast("accent", "与上次处理内容相同（或为其结果），已跳过防重复");
      return;
    }
    setSource(text);
    // 历史缓存命中：相同文本+相同模式直接用缓存结果，跳过 API 调用
    const cached = tryLoadFromHistory(text, modeRef.current);
    if (cached) {
      setResult(cached);
      setStatus("done");
      setError(null);
      setCopied(null);
      runSigRef.current = [modeRef.current, styleRef.current, directionRef.current, text].join("|");
      lastAutoRef.current = { text, mode: modeRef.current, at: Date.now(), result: cached.result };
      fromHistoryRef.current = true;
      pushToast("accent", "命中历史记录，已跳过 API 调用");
      return;
    }
    void runProcess(modeRef.current, text, { auto: true });
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
          pushToast("ok", "结果已补写进剪贴板");
        }
      } else if (clip.value === lastSourceRef.current) {
        const ok = await writeClipboard(pending);
        if (ok) {
          pendingWriteRef.current = null;
          setCopied("auto");
          pushToast("ok", "结果已补写进剪贴板");
        }
      } else {
        pendingWriteRef.current = null;
        pushToast("warn", "剪贴板已有新内容，上次结果未写回（可在历史中找回）");
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
    const onPaste = (e: ClipboardEvent) => {
      if (authRef.current !== "ok") return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-plain-input]")) return;
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (!text.trim()) return;
      e.preventDefault();
      if (isSkippable(text.trim())) {
        pushToast("warn", "剪贴板是链接或内容过短，已跳过自动处理");
        return;
      }
      setSource(text.trim());
      // 历史缓存命中
      const cached = tryLoadFromHistory(text.trim(), modeRef.current);
      if (cached) {
        setResult(cached); setStatus("done"); setError(null); setCopied(null);
        runSigRef.current = [modeRef.current, styleRef.current, directionRef.current, text.trim()].join("|");
        fromHistoryRef.current = true;
        pushToast("accent", "命中历史记录，已跳过 API 调用");
        return;
      }
      void runProcess(modeRef.current, text.trim(), { auto: true });
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
        if (!silent) setLockShake(true);
        if (!silent) setTimeout(() => setLockShake(false), 450);
        return false;
      }
      // 网络等错误：允许带着口令进入（离线可用，AI 调用时会再报错）
      passcodeRef.current = passcode;
      setAuth("ok");
      setHistory(await listHistory());
      if (!silent) pushToast("warn", "网络异常，已离线进入（AI 功能暂不可用）");
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
        void runProcess(modeRef.current, source, {});
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
      <>
        <div className="bg-glow glow-a" />
        <div className="bg-glow glow-b" />
        {auth === "locked" ? (
          <LockScreen passcode={passcodeInput} onPasscode={setPasscodeInput} onUnlock={() => void unlock()} shake={lockShake} />
        ) : (
          <div className="lock-screen"><div className="lock-sub">正在验证口令…</div></div>
        )}
        <Toaster items={toasts} />
      </>
    );
  }

  const clipPillState = !settings.autoRead ? "off" : clipState;
  let stripText = "待机 — 激活窗口时将自动读取剪贴板";
  let stripTone = "";
  if (status === "processing") { stripText = `正在处理 · ${MODE_LABELS[mode]}中…`; stripTone = "busy"; }
  else if (status === "error" && error) { stripText = error.title; stripTone = "err"; }
  else if (status === "done") {
    stripText = `已完成 · 用时 ${elapsed}` + (copied === "auto" ? " · 已写回剪贴板" : "");
    stripTone = "ok";
  } else if (source) {
    stripText = `就绪 · ${MODE_LABELS[mode]}模式（上次使用，已记忆）`;
  }

  return (
    <>
      <div className="bg-glow glow-a" />
      <div className="bg-glow glow-b" />
      <div className="app">
        <TopBar
          mode={mode}
          onMode={(m) => { setMode(m); setShowChanges(false); }}
          clipState={clipPillState}
          usage={usage}
          busy={status === "processing"}
          onHistory={() => setShowHistory(true)}
          onSettings={() => setShowSettings(true)}
          onToggleTheme={() => setThemePref(resolvedTheme === "dark" ? "light" : "dark")}
          resolvedTheme={resolvedTheme}
        />

        <div className={"status-strip " + stripTone}>
          <span>{stripText}</span>
          <span className="status-hint">⌘⏎ 运行 · ⌘⇧C 复制结果</span>
        </div>

        <main className="workbench">
          <SourcePanel
            mode={mode}
            source={source}
            onSource={setSource}
            busy={status === "processing"}
            onRun={() => void runProcess(mode, source, {})}
            onPaste={async () => {
              const clip = await readClipboard();
              if (clip.ok) {
                setSource(clip.value);
                pushToast("ok", "已粘贴剪贴板内容");
              } else {
                pushToast("warn", clip.reason === "denied" ? "无法读取剪贴板（未授权或浏览器限制）" : "剪贴板为空");
              }
            }}
            onClear={() => { setSource(""); setStatus("idle"); setResult(null); setError(null); setCopied(null); }}
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
                .map((c, i) => `${i + 1}. ${c.original} → ${c.revised}\n   理由：${c.reason}`)
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
            onRerun={() => { fromHistoryRef.current = false; void runProcess(mode, source, {}); }}
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
            setResult({ result: it.result, changes: it.changes, detectedLang: "zh", direction: null, model: settings.model, usage: usage ?? { used: 0, limit: 0, date: "" } });
            setStatus("done");
            setError(null);
            setCopied(null);
            runSigRef.current = [it.mode, styleRef.current, directionRef.current, it.source.trim()].join("|");
            setShowHistory(false);
            pushToast("accent", "已载入历史记录");
          }}
          onDelete={(id) => { void deleteHistory(id).then(() => listHistory()).then(setHistory); }}
          onClear={() => { void clearHistory().then(() => setHistory([])); pushToast("ok", "历史已清空"); }}
        />

        <SettingsDrawer
          open={showSettings}
          settings={settings}
          onSet={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          onClose={() => setShowSettings(false)}
          themePref={themePref}
          onTheme={setThemePref}
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
              pushToast("ok", "自定义风格已保存");
            }}
          />
        ) : null}
      </div>
      <Toaster items={toasts} />
    </>
  );
}
