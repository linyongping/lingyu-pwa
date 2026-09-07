// panes.jsx — 展示型组件（props 进、回调出；状态全部在 App）
const { LYIcon } = window;

/* ── 顶栏 ─────────────────────────────── */
function LYTopBar({ mode, onMode, clipState, usage, onHistory, onSettings, theme, onTheme }) {
  const clipText = clipState === "denied" ? "剪贴板 · 需要授权" : clipState === "off" ? "自动读取 关" : "剪贴板监听中";
  const usageTone = usage >= 10000 ? " err" : usage >= 9000 ? " warn" : "";
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark"><LYIcon name="translate" size={17} /></span>
        <span className="brand-name">邻语 <span style={{ opacity: 0.55 }}>Lingyu</span></span>
        <span className="brand-tag">PWA · UI 原型</span>
      </div>
      <nav className="mode-tabs" aria-label="处理模式">
        <button className={"mode-tab" + (mode === "translate" ? " active" : "")} onClick={() => onMode("translate")}>
          <LYIcon name="translate" size={15} />翻译
        </button>
        <button className={"mode-tab" + (mode === "grammar" ? " active" : "")} onClick={() => onMode("grammar")}>
          <LYIcon name="spellcheck" size={15} />语法检查
        </button>
        <button className={"mode-tab" + (mode === "polish" ? " active" : "")} onClick={() => onMode("polish")}>
          <LYIcon name="wand" size={15} />润色
        </button>
      </nav>
      <div className="spacer"></div>
      <span className={"pill clip-pill " + clipState}>
        <span className="clip-dot"></span>{clipText}
      </span>
      <span className={"pill" + usageTone}>
        <LYIcon name="zap" size={12} />AI 用量 {usage.toLocaleString()} / 10,000
      </span>
      <button className="icon-btn" title="历史记录" aria-label="历史记录" onClick={onHistory}><LYIcon name="history" size={17} /></button>
      <button className="icon-btn" title="设置" aria-label="设置" onClick={onSettings}><LYIcon name="settings" size={17} /></button>
      <button className="icon-btn" title={theme === "dark" ? "切换浅色" : "切换深色"} aria-label="切换主题" onClick={onTheme}>
        <LYIcon name={theme === "dark" ? "sun" : "moon"} size={16} />
      </button>
    </header>
  );
}

/* ── 状态条 ─────────────────────────────── */
function LYStatusStrip({ text, tone }) {
  return (
    <div className={"status-strip " + (tone || "")}>
      <span>{text}</span>
      <span className="status-hint">⌘⏎ 运行 · ⌘⇧C 复制结果</span>
    </div>
  );
}

/* ── 原文面板 ─────────────────────────────── */
function LYSourcePanel({ mode, source, onSource, busy, onRun, onPaste, onClear, charMax }) {
  const runLabel = mode === "translate" ? "翻译" : mode === "grammar" ? "检查" : "润色";
  const over = source.length > charMax;
  return (
    <section className="glass panel" data-screen-label="原文面板" aria-label="原文">
      <div className="panel-head">
        <span className="panel-title"><LYIcon name="clipboard" size={15} />原文 · 剪贴板</span>
        <div className="panel-head-right">
          {source ? (
            <button className="btn ghost small" onClick={onClear}><LYIcon name="x" size={13} />清空</button>
          ) : null}
        </div>
      </div>
      <div className="panel-body" style={{ display: "flex" }}>
        <textarea
          className="src-textarea"
          placeholder={"在此粘贴或输入原文…\n激活窗口时会自动读取剪贴板并开始" + LY_MODE_LABELS[mode] + "。"}
          value={source}
          onChange={(e) => onSource(e.target.value)}
          spellCheck="false"
        ></textarea>
        {!source ? (
          <div className="empty-state">
            <span className="empty-icon"><LYIcon name="clipboard" size={26} /></span>
            <span className="empty-title">等待剪贴板内容</span>
            <span className="empty-sub">切回本窗口时将自动读取剪贴板并开始处理；也可以直接按 ⌘V 粘贴，或用右下角「演示控制」体验完整流程。</span>
            <div className="kbd-hints">
              <span><kbd>⌘V</kbd>粘贴</span>
              <span><kbd>⌘⏎</kbd>立即运行</span>
            </div>
          </div>
        ) : null}
      </div>
      <div className="panel-foot">
        <span className={"char-count" + (over ? " over" : "")}>{source.length.toLocaleString()} / {charMax.toLocaleString()}</span>
        <div className="spacer"></div>
        <button className="btn small" onClick={onPaste} disabled={busy}><LYIcon name="clipboardPaste" size={13} />粘贴</button>
        <button className="btn accent small" onClick={onRun} disabled={busy || !source.trim() || over}>
          <LYIcon name="play" size={12} />{runLabel}
        </button>
      </div>
    </section>
  );
}

/* ── 结果面板 ─────────────────────────────── */
function LYDiffText({ segments, changes }) {
  return (
    <div className="result-text">
      {segments.map((seg, i) =>
        seg.changeIdx === null ? (
          <React.Fragment key={i}>{seg.text}</React.Fragment>
        ) : (
          <mark key={i} className="ly-diff" title={(changes[seg.changeIdx] && changes[seg.changeIdx].reason) || ""}>{seg.text}</mark>
        )
      )}
    </div>
  );
}

function LYChangesList({ changes }) {
  return (
    <div className="changes">
      <div className="changes-title">改动说明 · {changes.length}</div>
      {changes.map((c, i) => (
        <div className="change-item" key={i}>
          <span className="change-no">{i + 1}</span>
          <div>
            <div className="change-pair">
              <span className="del">{c.original}</span>
              <span className="arrow">→</span>
              <span className="ins">{c.revised}</span>
            </div>
            <div className="change-reason">{c.reason}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LYResultPanel({ mode, status, result, busy, error, showChanges, onToggleChanges, onCopyResult, onCopyNotes, copied, style, onStyle, direction, onCycleDirection, onEditCustom, elapsed }) {
  const stageNames = ["读取剪贴板", "分析语言", mode === "translate" ? "生成译文" : mode === "grammar" ? "检查语法" : "润色语句"];
  const hasChanges = result && result.changes && result.changes.length > 0;

  return (
    <section className="glass panel" data-screen-label="结果面板" aria-label="处理结果">
      <div className="panel-head">
        <span className="panel-title"><LYIcon name="wand" size={15} />{LY_MODE_LABELS[mode]}结果</span>
        <div className="panel-head-right">
          {status === "done" && result ? <span className="chip dim">{elapsed}</span> : null}
        </div>
      </div>
      <div className="panel-body">

        {status === "idle" && !busy ? (
          <div className="empty-state">
            <span className="empty-icon"><LYIcon name="wand" size={26} /></span>
            <span className="empty-title">处理结果会出现在这里</span>
            <span className="empty-sub">选择上方模式后，粘贴内容将自动处理；结果默认自动写回剪贴板。</span>
          </div>
        ) : null}

        {status === "processing" ? (
          <div>
            <div className="steps">
              {stageNames.map((s, i) => (
                <span className={"step" + (i === 2 ? " active" : i < 2 ? " done" : "")} key={s}>
                  {i < 2 ? <LYIcon name="check" size={11} /> : null}{s}
                </span>
              ))}
            </div>
            <div className="skel">
              <div className="skel-line w40"></div>
              <div className="skel-line w95"></div>
              <div className="skel-line w80"></div>
              <div className="skel-line w95"></div>
              <div className="skel-line w60"></div>
            </div>
          </div>
        ) : null}

        {status === "error" && error ? (
          <div className="error-card">
            <LYIcon name="alert" size={19} />
            <div>
              <div className="error-title">{error.title}</div>
              <div className="error-desc">{error.desc}</div>
            </div>
          </div>
        ) : null}

        {status === "done" && result ? (
          <div>
            <div className="result-meta">
              {mode === "translate" && result.direction ? (
                <button className="chip accent clickable" onClick={onCycleDirection} title="点击切换方向锁定">
                  <LYIcon name="swap" size={12} />
                  {direction === "auto"
                    ? "自动识别 · " + (result.direction === "zh2en" ? "中文 → English" : "English → 中文")
                    : direction === "zh2en" ? "已锁定 中文 → English" : "已锁定 English → 中文"}
                </button>
              ) : null}
              {mode === "polish" ? <span className="chip accent"><LYIcon name="wand" size={12} />{(LY_STYLES.find((s) => s.id === style) || {}).label}风格</span> : null}
              {result.demo ? <span className="chip warn">演示数据</span> : null}
            </div>

            {mode === "polish" ? (
              <div className="style-row">
                {LY_STYLES.map((s) => (
                  <button
                    key={s.id}
                    className={"style-chip" + (style === s.id ? " sel" : "")}
                    onClick={() => (s.id === "custom" ? onEditCustom() : onStyle(s.id))}
                  >{s.label}</button>
                ))}
              </div>
            ) : null}

            {hasChanges && mode === "grammar" ? (
              <LYDiffText segments={lyBuildDiffSegments(result.result, result.changes)} changes={result.changes} />
            ) : (
              <div className="result-text">{result.result}</div>
            )}

            {hasChanges && mode === "grammar" ? <LYChangesList changes={result.changes} /> : null}
            {hasChanges && mode === "polish" ? (
              <div className="changes">
                <div className="changes-title">
                  改动说明 · {result.changes.length}
                  <button className="btn ghost small changes-toggle" onClick={onToggleChanges}>
                    <LYIcon name={showChanges ? "chevron" : "eye"} size={13} />{showChanges ? "收起" : "显示改动"}
                  </button>
                </div>
                {showChanges ? <LYChangesList changes={result.changes} /> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="panel-foot">
        {status === "done" && result ? (
          <React.Fragment>
            {copied === "auto" ? <span className="copy-ok"><LYIcon name="check" size={13} />已自动写回剪贴板 · 切回文档 ⌘V 粘贴</span> : null}
            {copied === "manual" ? <span className="copy-ok"><LYIcon name="check" size={13} />已复制</span> : null}
            {copied === "failed" ? <span className="copy-fail"><LYIcon name="alert" size={13} />复制失败（原型环境无权限）</span> : null}
            {copied === null ? <span style={{ opacity: 0.75 }}>结果已就绪</span> : null}
            <div className="spacer"></div>
            {hasChanges ? <button className="btn small" onClick={onCopyNotes}><LYIcon name="copy" size={12} />复制说明</button> : null}
            <button className="btn accent small" onClick={onCopyResult}><LYIcon name="copy" size={12} />复制结果</button>
          </React.Fragment>
        ) : (
          <span style={{ opacity: 0.75 }}>AI 结果 · Qwen2.5-72B（免费额度）</span>
        )}
      </div>
    </section>
  );
}

/* ── 抽屉（历史 / 设置） ─────────────────────── */
function LYDrawer({ open, title, onClose, children, foot }) {
  if (!open) return null;
  return (
    <React.Fragment>
      <div className="scrim" onClick={onClose}></div>
      <aside className="drawer" data-screen-label={title} role="dialog" aria-label={title}>
        <div className="drawer-head">
          <span className="drawer-title">{title}</span>
          <div className="spacer"></div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭"><LYIcon name="x" size={15} /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {foot ? <div className="drawer-foot">{foot}</div> : null}
      </aside>
    </React.Fragment>
  );
}

function LYHistoryDrawer({ open, items, filter, onFilter, onClose, onLoad, onDelete, onClear }) {
  const filtered = filter === "all" ? items : items.filter((it) => it.mode === filter);
  return (
    <LYDrawer open={open} title="历史记录" onClose={onClose} foot={"本地 IndexedDB · 最多保留 200 条（原型存于 localStorage）"}>
      <div className="h-filter">
        {[["all", "全部"], ["translate", "翻译"], ["grammar", "检查"], ["polish", "润色"]].map(([id, label]) => (
          <button key={id} className={"style-chip" + (filter === id ? " sel" : "")} onClick={() => onFilter(id)}>{label}</button>
        ))}
        <div className="spacer"></div>
        {items.length ? <button className="btn ghost small" onClick={onClear}><LYIcon name="trash" size={13} />清空</button> : null}
      </div>
      {filtered.length === 0 ? (
        <div className="h-empty">还没有处理记录</div>
      ) : filtered.map((it) => (
        <div className="h-item" key={it.id} onClick={() => onLoad(it)}>
          <div className="h-item-main">
            <div className="h-meta">
              <span className={"h-badge " + it.mode}>{LY_MODE_LABELS[it.mode]}</span>
              <span className="h-time">{lyFormatTime(it.time)}</span>
              {it.styleLabel ? <span className="h-time">{it.styleLabel}</span> : null}
            </div>
            <div className="h-src">{it.source}</div>
          </div>
          <button
            className="h-del"
            aria-label="删除该条"
            onClick={(e) => { e.stopPropagation(); onDelete(it.id); }}
          ><LYIcon name="trash" size={14} /></button>
        </div>
      ))}
    </LYDrawer>
  );
}

function LYSettingsDrawer({ open, settings, onSet, onClose, theme, onTheme }) {
  return (
    <LYDrawer open={open} title="设置" onClose={onClose} foot="访问口令已保存至本机 · localhost（原型）">
      <div className="set-row">
        <div>
          <div className="set-label">剪贴板自动读取</div>
          <div className="set-desc">激活窗口时自动读取并开始处理</div>
        </div>
        <button className={"switch" + (settings.autoRead ? " on" : "")} aria-label="剪贴板自动读取" onClick={() => onSet({ autoRead: !settings.autoRead })}></button>
      </div>
      <div className="set-row">
        <div>
          <div className="set-label">结果自动复制</div>
          <div className="set-desc">处理完成后自动写回剪贴板</div>
        </div>
        <button className={"switch" + (settings.autoCopy ? " on" : "")} aria-label="结果自动复制" onClick={() => onSet({ autoCopy: !settings.autoCopy })}></button>
      </div>
      <div className="set-block">
        <div className="set-block-label">说明语言</div>
        <div className="seg">
          <button className={"seg-btn" + (settings.explainLang === "zh" ? " active" : "")} onClick={() => onSet({ explainLang: "zh" })}>中文</button>
          <button className={"seg-btn" + (settings.explainLang === "en" ? " active" : "")} onClick={() => onSet({ explainLang: "en" })}>English</button>
        </div>
      </div>
      <div className="set-block">
        <div className="set-block-label">AI 模型（Workers AI）</div>
        <div className="model-grid">
          <button className={"model-card" + (settings.model === "qwen" ? " sel" : "")} onClick={() => onSet({ model: "qwen" })}>
            <div className="model-name">Qwen2.5-72B<span className="model-tag">默认</span></div>
            <div className="model-desc">质量优先 · 中英最佳</div>
          </button>
          <button className={"model-card" + (settings.model === "llama" ? " sel" : "")} onClick={() => onSet({ model: "llama" })}>
            <div className="model-name">Llama-3.1-8B<span className="model-tag">轻快</span></div>
            <div className="model-desc">响应更快 · 更省额度</div>
          </button>
        </div>
      </div>
      <div className="set-block">
        <div className="set-block-label">外观</div>
        <div className="seg">
          <button className={"seg-btn" + (theme === "dark" ? " active" : "")} onClick={() => onTheme("dark")}>深色</button>
          <button className={"seg-btn" + (theme === "light" ? " active" : "")} onClick={() => onTheme("light")}>浅色</button>
        </div>
      </div>
    </LYDrawer>
  );
}

/* ── 锁屏 / 首次引导 / 弹窗 ─────────────────── */
function LYLockScreen({ passcode, onPasscode, onUnlock, shake, hint }) {
  return (
    <div className="lock-screen" data-screen-label="锁屏">
      <div className="lock-card">
        <span className="lock-logo"><LYIcon name="translate" size={26} /></span>
        <div className="lock-title">邻语 Lingyu</div>
        <div className="lock-sub">剪贴板翻译台 · 粘贴即处理</div>
        <input
          className={"lock-input" + (shake ? " err" : "")}
          type="password"
          inputMode="numeric"
          maxLength="6"
          placeholder="••••"
          value={passcode}
          onChange={(e) => onPasscode(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onUnlock(); }}
          aria-label="访问口令"
        />
        <div className="lock-err">{shake ? "口令至少 4 位" : hint || ""}</div>
        <button className="btn accent lock-btn" onClick={onUnlock}><LYIcon name="lock" size={15} />解锁工作台</button>
        <div className="lock-hint">原型环境：输入任意 4 位数字即可</div>
      </div>
    </div>
  );
}

function LYModal({ onClose, children }) {
  return (
    <React.Fragment>
      <div className="scrim" style={{ zIndex: 64 }} onClick={onClose}></div>
      <div className="modal-card pop-in" role="dialog">{children}</div>
    </React.Fragment>
  );
}

function LYOnboard({ onDone }) {
  return (
    <LYModal onClose={onDone}>
      <div className="modal-title">欢迎使用邻语</div>
      <div className="modal-sub">三步完成设置，之后就是「粘贴即结果」</div>
      <div className="ob-step">
        <span className="ob-no">1</span>
        <div>
          <div className="ob-title">允许读取剪贴板</div>
          <div className="ob-desc">浏览器会弹出授权提示，点击「允许」；桌面 Chrome / Edge / Safari 均支持，之后不再询问。</div>
        </div>
      </div>
      <div className="ob-step">
        <span className="ob-no">2</span>
        <div>
          <div className="ob-title">切回即处理</div>
          <div className="ob-desc">从任何文档切回邻语窗口，会自动读取剪贴板里的最新文本，按上次使用的模式开始处理。</div>
        </div>
      </div>
      <div className="ob-step">
        <span className="ob-no">3</span>
        <div>
          <div className="ob-title">结果自动写回</div>
          <div className="ob-desc">处理完成后结果自动复制，切回原文档直接 ⌘V 粘贴；原文始终保留在历史记录中。</div>
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn accent" onClick={onDone}>开始使用</button>
      </div>
    </LYModal>
  );
}

function LYCustomStyleModal({ value, onSave, onClose }) {
  const [draft, setDraft] = React.useState(value);
  return (
    <LYModal onClose={onClose}>
      <div className="modal-title">自定义润色指令</div>
      <div className="modal-sub">描述你想要的语气与格式，会作为系统提示词发送给模型。</div>
      <textarea
        className="custom-textarea"
        placeholder="例如：改写成适合技术博客的语气，保留代码块与专有名词，句子尽量短。"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      ></textarea>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>取消</button>
        <button className="btn accent" onClick={() => onSave(draft.trim())}>保存并使用</button>
      </div>
    </LYModal>
  );
}

/* ── Toast / 演示控制 ─────────────────────── */
function LYToasts({ items }) {
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div className={"toast " + (t.kind || "")} key={t.id}>
          <LYIcon name={t.kind === "ok" ? "check" : t.kind === "warn" ? "alert" : t.kind === "err" ? "alert" : "zap"} size={14} />
          {t.text}
        </div>
      ))}
    </div>
  );
}

function LYDemoPanel({ open, onToggle, actions, clipDenied }) {
  return (
    <React.Fragment>
      <button className="demo-fab" onClick={onToggle}>
        <LYIcon name="zap" size={14} />演示控制
      </button>
      {open ? (
        <div className="demo-panel" data-screen-label="演示控制面板">
          <div className="demo-sec">核心流程</div>
          <button className="demo-btn" onClick={actions.focus}><LYIcon name="rerun" size={14} />模拟切回 App（读剪贴板）</button>
          <button className="demo-btn" onClick={() => actions.paste("s1")}><LYIcon name="clipboardPaste" size={14} />示例：中文 → 翻译</button>
          <button className="demo-btn" onClick={() => actions.paste("s2")}><LYIcon name="clipboardPaste" size={14} />示例：英文 → 语法检查</button>
          <button className="demo-btn" onClick={() => actions.paste("s3")}><LYIcon name="clipboardPaste" size={14} />示例：英文 → 润色</button>
          <button className="demo-btn" onClick={() => actions.paste("s4")}><LYIcon name="clipboardPaste" size={14} />示例：中文 → 语法检查</button>
          <div className="demo-sec">边界与错误态</div>
          <button className="demo-btn" onClick={actions.skip}><LYIcon name="alert" size={14} />粘贴链接（应自动跳过）</button>
          <button className="demo-btn" onClick={actions.toolong}><LYIcon name="alert" size={14} />超过 4000 字符</button>
          <button className="demo-btn" onClick={actions.quota}><LYIcon name="zap" size={14} />模拟额度用尽（429）</button>
          <button className="demo-btn" onClick={actions.noperm}><LYIcon name="lock" size={14} />模拟剪贴板未授权</button>
          <div className="demo-sec">其他</div>
          <button className="demo-btn" onClick={actions.lock}><LYIcon name="lock" size={14} />回到锁屏</button>
          <button className="demo-btn" onClick={actions.reset}><LYIcon name="rerun" size={14} />重置演示数据</button>
        </div>
      ) : null}
    </React.Fragment>
  );
}

Object.assign(window, {
  LYTopBar, LYStatusStrip, LYSourcePanel, LYResultPanel, LYDiffText, LYChangesList,
  LYDrawer, LYHistoryDrawer, LYSettingsDrawer, LYLockScreen, LYModal, LYOnboard,
  LYCustomStyleModal, LYToasts, LYDemoPanel,
});
