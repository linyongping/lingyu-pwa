// app.jsx — 状态编排：剪贴板闭环 / 模式记忆 / 防重 / 历史 / 额度模拟
const { useState, useEffect, useRef, useCallback } = React;
const {
  LYTopBar, LYStatusStrip, LYSourcePanel, LYResultPanel,
  LYHistoryDrawer, LYSettingsDrawer, LYLockScreen, LYOnboard, LYCustomStyleModal,
  LYToasts, LYDemoPanel, LYIcon,
} = window;

const CHAR_MAX = 4000;
const DEDUPE_WINDOW = 5 * 60 * 1000;

// ?demo=1 直达工作台（跳过锁屏与引导）；可选 mode / sample / theme 参数用于评审与截图
const DEMO_PARAMS = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
const DEMO = DEMO_PARAMS.has("demo");
const DEMO_MODE = ["translate", "grammar", "polish"].includes(DEMO_PARAMS.get("mode")) ? DEMO_PARAMS.get("mode") : null;
const DEMO_THEME = ["dark", "light"].includes(DEMO_PARAMS.get("theme")) ? DEMO_PARAMS.get("theme") : null;

function lyLoadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v === null || v === undefined ? fallback : v;
  } catch (e) { return fallback; }
}

function LYApp() {
  const [view, setView] = useState(DEMO ? "app" : "locked");   // locked | app
  const [onboarded, setOnboarded] = useState(() => DEMO || localStorage.getItem("ly_onboarded") === "1");
  const [showOnboard, setShowOnboard] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [theme, setTheme] = useState(() => (DEMO && DEMO_THEME) || localStorage.getItem("ly_theme") || "dark");

  const [mode, setMode] = useState(() => (DEMO && DEMO_MODE) || localStorage.getItem("ly_mode") || "translate");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("idle");          // idle | processing | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState("1.9s");
  const [copied, setCopied] = useState(null);            // auto | manual | failed | null

  const [direction, setDirection] = useState("auto");    // auto | zh2en | en2zh
  const [style, setStyle] = useState("formal");
  const [customStyle, setCustomStyle] = useState(() => localStorage.getItem("ly_custom_style") || "");
  const [showChanges, setShowChanges] = useState(false);

  const [settings, setSettings] = useState(() => lyLoadJSON("ly_settings", { autoRead: true, autoCopy: true, model: "qwen", explainLang: "zh" }));
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(() => lyLoadJSON("ly_history", []));
  const [hFilter, setHFilter] = useState("all");

  const [usage, setUsage] = useState(18);
  const [quotaDemo, setQuotaDemo] = useState(false);
  const [clipState, setClipState] = useState("on");      // on | denied | off
  const [toasts, setToasts] = useState([]);
  const [demoOpen, setDemoOpen] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [lockShake, setLockShake] = useState(false);

  // 用 ref 镜像状态，避免定时器/异步回调里的闭包过期
  const modeRef = useRef(mode); modeRef.current = mode;
  const styleRef = useRef(style); styleRef.current = style;
  const directionRef = useRef(direction); directionRef.current = direction;
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const quotaRef = useRef(quotaDemo); quotaRef.current = quotaDemo;
  const usageRef = useRef(usage); usageRef.current = usage;
  const busyRef = useRef(false);
  const denyRef = useRef(false);
  const lastAutoRef = useRef({ text: "", at: 0 });
  const sampleIdxRef = useRef(0);
  const runSigRef = useRef("");
  const timersRef = useRef([]);

  /* ── 持久化 ───────────────────────────── */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ly_theme", theme);
  }, [theme]);
  useEffect(() => { localStorage.setItem("ly_mode", mode); }, [mode]);
  useEffect(() => { localStorage.setItem("ly_settings", JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem("ly_custom_style", customStyle); }, [customStyle]);
  useEffect(() => { localStorage.setItem("ly_history", JSON.stringify(history.slice(0, 200))); }, [history]);

  /* ── Toast ────────────────────────────── */
  const pushToast = useCallback((kind, text) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-3), { id, kind, text }]);
    const t = setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 3400);
    timersRef.current.push(t);
  }, []);

  /* ── 复制 ─────────────────────────────── */
  const attemptCopy = useCallback((text, kind) => {
    const done = () => setCopied(kind === "auto" ? "auto" : "manual");
    const fail = () => { setCopied("failed"); pushToast("warn", "原型环境无法访问剪贴板，复制失败"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fail);
    } else { fail(); }
  }, [pushToast]);

  /* ── 核心处理流（模拟 AI 调用） ──────────── */
  const runProcess = useCallback((modeArg, textArg, opts) => {
    const t = (textArg !== undefined ? textArg : source).trim();
    const m = modeArg || modeRef.current;
    if (!t) { pushToast("warn", "没有可处理的内容"); return; }
    if (t.length > CHAR_MAX) {
      setError({
        title: "文本超过 " + CHAR_MAX.toLocaleString() + " 字符上限",
        desc: "当前 " + t.length.toLocaleString() + " 字符。请缩短后重试；正式版本会提供按段自动拆分处理。",
      });
      setStatus("error"); setResult(null); setCopied(null);
      pushToast("err", "超过 4000 字符上限，已拒绝处理");
      return;
    }
    if (quotaRef.current || usageRef.current >= 10000) {
      setError({
        title: "今日 AI 额度已用尽",
        desc: "Workers AI 免费额度（10,000 单位/天）已耗尽，明天自动恢复；也可切换轻量模型降低消耗。",
      });
      setStatus("error"); setResult(null); setCopied(null);
      pushToast("err", "额度用尽 · 服务器返回 429");
      return;
    }

    setError(null); setCopied(null); setResult(null);
    setStatus("processing"); busyRef.current = true;

    const started = performance.now();
    const stages = [420, 1020, 1750];
    stages.forEach((ms, i) => {
      const t2 = setTimeout(() => {
        if (i < stages.length - 1) return;
        const mock = lyMockFor(m, t, directionRef.current);
        const used = ((performance.now() - started) / 1000).toFixed(1) + "s";
        setResult(mock);
        setElapsed(used);
        setStatus("done");
        busyRef.current = false;
        setUsage((u) => Math.min(u + 1, 10000));
        runSigRef.current = [m, styleRef.current, directionRef.current, t].join("|");
        lastAutoRef.current = opts && opts.auto ? { text: t, at: Date.now() } : lastAutoRef.current;
        setHistory((hs) => [{
          id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
          mode: m,
          source: t,
          styleLabel: m === "polish" ? (LY_STYLES.find((s) => s.id === styleRef.current) || {}).label : null,
          time: Date.now(),
        }, ...hs].slice(0, 200));
        if (settingsRef.current.autoCopy) {
          if (DEMO) { setCopied("auto"); }          // 演示模式：无头浏览器/截图环境直接模拟写回
          else { attemptCopy(mock.result, "auto"); }
        }
        if (opts && opts.auto) {
          pushToast("ok", "已读取剪贴板并自动" + LY_MODE_LABELS[m] + "完成");
        }
      }, ms);
      timersRef.current.push(t2);
    });
  }, [source, pushToast, attemptCopy]);

  /* 模式/风格/方向变化时，若已有结果则自动按新模式重跑 */
  useEffect(() => {
    if (view !== "app" || busyRef.current || status !== "done" || !source.trim()) return;
    const sig = [mode, style, direction, source.trim()].join("|");
    if (sig === runSigRef.current) return;
    runProcess(mode, source, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, style, direction, source, status, view]);

  /* ── 剪贴板闭环：模拟「切回 App」 ─────────── */
  const simulateFocus = useCallback(async (forcedSample) => {
    if (!settingsRef.current.autoRead) {
      pushToast("warn", "自动读取已关闭（设置中可开启）");
      return;
    }
    if (denyRef.current) {
      setClipState("denied");
      const s = forcedSample || LY_AUTO_SAMPLES[sampleIdxRef.current % LY_AUTO_SAMPLES.length];
      sampleIdxRef.current += 1;
      pushToast("warn", "未获得剪贴板权限——真实浏览器会弹出授权提示");
      setSource(s.text);
      runProcess(modeRef.current, s.text, { auto: true });
      return;
    }

    let text = null;
    try {
      const c = await navigator.clipboard.readText();
      if (c && c.trim()) text = c.trim();
    } catch (e) { /* 未授权或非安全上下文 */ }

    if (!text) {
      const s = forcedSample || LY_AUTO_SAMPLES[sampleIdxRef.current % LY_AUTO_SAMPLES.length];
      sampleIdxRef.current += 1;
      pushToast("accent", "未读到剪贴板内容，改用示例文本演示");
      setSource(s.text);
      runProcess(modeRef.current, s.text, { auto: true });
      return;
    }

    setClipState("on");
    if (lyIsSkippable(text)) {
      pushToast("warn", "剪贴板是链接或内容过短，已跳过自动处理");
      return;
    }
    const la = lastAutoRef.current;
    if (text === la.text && Date.now() - la.at < DEDUPE_WINDOW) {
      setSource(text);
      pushToast("accent", "与上次内容相同，5 分钟内不重复消耗额度");
      return;
    }
    setSource(text);
    runProcess(modeRef.current, text, { auto: true });
  }, [pushToast, runProcess]);

  /* ── 演示动作 ─────────────────────────── */
  const demoActions = {
    focus: () => { setDemoOpen(false); simulateFocus(); },
    paste: (id) => {
      setDemoOpen(false);
      const s = LY_SAMPLES.find((x) => x.id === id);
      setSource(s.text);
      runProcess(modeRef.current, s.text, { auto: true });
    },
    skip: () => {
      setDemoOpen(false);
      setSource("https://example.com/some/very/long/url?utm_source=clipboard-demo");
      pushToast("warn", "剪贴板是链接或内容过短，已跳过自动处理");
    },
    toolong: () => {
      setDemoOpen(false);
      setSource(LY_LONG_TEXT);
      runProcess(modeRef.current, LY_LONG_TEXT, {});
    },
    quota: () => {
      setDemoOpen(false);
      setQuotaDemo(true);
      setUsage(10000);
      pushToast("warn", "已模拟额度用尽——点击「运行」即可看到 429 状态");
    },
    noperm: () => {
      setDemoOpen(false);
      denyRef.current = true;
      setClipState("denied");
      pushToast("warn", "已模拟未授权——再点「模拟切回 App」看降级表现");
    },
    lock: () => { setDemoOpen(false); setView("locked"); setPasscode(""); },
    reset: () => {
      setDemoOpen(false);
      setHistory([]); setUsage(18); setQuotaDemo(false); denyRef.current = false;
      setSource(""); setResult(null); setStatus("idle"); setError(null); setCopied(null);
      setClipState("on"); sampleIdxRef.current = 0; lastAutoRef.current = { text: "", at: 0 };
      pushToast("ok", "演示数据已重置");
    },
  };

  /* ── 锁屏 / 引导 ──────────────────────── */
  const unlock = () => {
    if (passcode.length < 4) { setLockShake(true); setTimeout(() => setLockShake(false), 450); return; }
    setView("app");
    if (!onboarded) setShowOnboard(true);
    else setTimeout(() => simulateFocus(), 700);
  };
  const finishOnboard = () => {
    setShowOnboard(false);
    setOnboarded(true);
    localStorage.setItem("ly_onboarded", "1");
    setTimeout(() => simulateFocus(), 650);
  };

  /* ── 快捷键 ───────────────────────────── */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && view === "app" && !busyRef.current) {
        e.preventDefault(); runProcess(modeRef.current, undefined, {});
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "c" || e.key === "C") && result) {
        e.preventDefault(); attemptCopy(result.result, "manual");
      }
      if (e.key === "Escape") { setShowSettings(false); setShowHistory(false); setDemoOpen(false); setShowCustom(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, result, runProcess, attemptCopy]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  /* ?demo=… 直达指定状态（评审 / 截图用） */
  useEffect(() => {
    if (!DEMO) return;
    const sampleId = DEMO_PARAMS.get("sample");
    if (DEMO_PARAMS.get("quota") === "1") { setQuotaDemo(true); setUsage(10000); }
    if (!sampleId) return;
    let text = null;
    if (sampleId === "long") text = LY_LONG_TEXT;
    else if (sampleId === "url") {
      setSource("https://example.com/some/very/long/url?utm_source=clipboard-demo");
      pushToast("warn", "剪贴板是链接或内容过短，已跳过自动处理");
      return;
    } else {
      const s = LY_SAMPLES.find((x) => x.id === sampleId);
      if (s) text = s.text;
    }
    if (text) {
      setSource(text);
      // 延迟一拍：让 quota=1 等状态先完成渲染同步到 ref，再触发处理
      const t = setTimeout(() => runProcess(modeRef.current, text, {}), 80);
      timersRef.current.push(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 渲染 ─────────────────────────────── */
  const clipPillState = !settings.autoRead ? "off" : clipState;

  let stripText = "待机 — 激活窗口时将自动读取剪贴板";
  let stripTone = "";
  if (status === "processing") { stripText = "正在处理 · " + LY_MODE_LABELS[mode] + "中…"; stripTone = "busy"; }
  else if (status === "error" && error) { stripText = error.title; stripTone = "err"; }
  else if (status === "done") {
    stripText = "已完成" + (copied === "auto" ? " · 已写回剪贴板" : "");
    stripTone = "ok";
  } else if (source) { stripText = "就绪 · " + LY_MODE_LABELS[mode] + "模式（上次使用，已记忆）"; }

  if (view === "locked") {
    return (
      <React.Fragment>
        <LYLockScreen passcode={passcode} onPasscode={setPasscode} onUnlock={unlock} shake={lockShake} />
        <LYToasts items={toasts} />
      </React.Fragment>
    );
  }

  return (
    <div className="app" data-screen-label="工作台">
      <LYTopBar
        mode={mode}
        onMode={(m) => { setMode(m); setShowChanges(false); }}
        clipState={clipPillState}
        usage={usage}
        onHistory={() => setShowHistory(true)}
        onSettings={() => setShowSettings(true)}
        theme={theme}
        onTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />

      <LYStatusStrip text={stripText} tone={stripTone} />

      <main className="workbench">
        <LYSourcePanel
          mode={mode}
          source={source}
          onSource={setSource}
          busy={status === "processing"}
          onRun={() => runProcess(undefined, undefined, {})}
          onPaste={async () => {
            try {
              const c = await navigator.clipboard.readText();
              if (c && c.trim()) { setSource(c.trim()); pushToast("ok", "已粘贴剪贴板内容"); }
              else pushToast("warn", "剪贴板为空");
            } catch (e) {
              pushToast("warn", "无法读取剪贴板（未授权或浏览器限制）");
            }
          }}
          onClear={() => { setSource(""); setStatus("idle"); setResult(null); setError(null); }}
          charMax={CHAR_MAX}
        />
        <LYResultPanel
          mode={mode}
          status={status}
          result={result}
          busy={status === "processing"}
          error={error}
          showChanges={showChanges}
          onToggleChanges={() => setShowChanges(!showChanges)}
          onCopyResult={() => result && attemptCopy(result.result, "manual")}
          onCopyNotes={() => {
            if (!result || !result.changes) return;
            const notes = result.changes.map((c, i) => (i + 1) + ". " + c.original + " → " + c.revised + "\n   理由：" + c.reason).join("\n");
            attemptCopy(notes, "manual");
          }}
          copied={copied}
          style={style}
          onStyle={(s) => setStyle(s)}
          direction={direction}
          onCycleDirection={() => setDirection(direction === "auto" ? (result && result.direction === "zh2en" ? "zh2en" : "en2zh") : direction === "zh2en" ? "en2zh" : "auto")}
          onEditCustom={() => setShowCustom(true)}
          elapsed={elapsed}
        />
      </main>

      <LYHistoryDrawer
        open={showHistory}
        items={history}
        filter={hFilter}
        onFilter={setHFilter}
        onClose={() => setShowHistory(false)}
        onLoad={(it) => {
          setMode(it.mode); setSource(it.source);
          const mock = lyMockFor(it.mode, it.source, "auto");
          setResult(mock); setStatus("done"); setError(null); setCopied(null);
          runSigRef.current = [it.mode, styleRef.current, directionRef.current, it.source.trim()].join("|");
          setShowHistory(false);
          pushToast("accent", "已载入历史记录");
        }}
        onDelete={(id) => setHistory((hs) => hs.filter((x) => x.id !== id))}
        onClear={() => { setHistory([]); pushToast("ok", "历史已清空"); }}
      />

      <LYSettingsDrawer
        open={showSettings}
        settings={settings}
        onSet={(patch) => {
          setSettings((s) => Object.assign({}, s, patch));
          if (patch.autoRead === false) setClipState("off");
          if (patch.autoRead === true) setClipState("on");
        }}
        onClose={() => setShowSettings(false)}
        theme={theme}
        onTheme={setTheme}
      />

      {showOnboard ? <LYOnboard onDone={finishOnboard} /> : null}
      {showCustom ? (
        <LYCustomStyleModal
          value={customStyle}
          onClose={() => setShowCustom(false)}
          onSave={(v) => {
            setCustomStyle(v);
            setStyle("custom");
            setShowCustom(false);
            pushToast("ok", "自定义风格已保存（存于本地）");
          }}
        />
      ) : null}

      <LYDemoPanel open={demoOpen} onToggle={() => setDemoOpen(!demoOpen)} actions={demoActions} />
      <LYToasts items={toasts} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<LYApp />);
