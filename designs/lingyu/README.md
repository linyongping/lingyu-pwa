# Lingyu 邻语 — UI 设计原型

剪贴板翻译台的可交互 UI 原型（React 18 + Babel，浏览器内直接运行，无构建步骤）。
视觉方向：**深色玻璃质感**（Raycast / Arc DNA），浅色主题同 token 体系一键切换。

## 本地预览

```bash
cd /Users/linke/ai/lingyu-pwa
python3 -m http.server 4311 --directory designs
# 打开 http://localhost:4311/lingyu/Lingyu%20UI%20%E5%8E%9F%E5%9E%8B.html
```

必须走 HTTP（`file://` 下 Babel 的 `<script src>` 会被浏览器拦截）。

## 演示入口

- **锁屏**：任意 4 位数字解锁（演示口令保护形态）
- **首次引导**：解锁后出现一次（三步：授权剪贴板 → 切回即处理 → 结果自动写回）
- **右下角「演示控制」**是原型评审的核心入口：
  - 模拟切回 App（真实尝试 `navigator.clipboard.readText()`，失败则轮换示例文本）
  - 四段示例文本分别对应 翻译 / 英文检查 / 英文润色 / 中文检查
  - 边界态：链接跳过、超 4000 字符、额度用尽（429）、剪贴板未授权
  - 回到锁屏 / 重置演示
- 快捷键：`⌘⏎` 运行，`⌘⇧C` 复制结果，`Esc` 关闭抽屉/弹层

## 设计 token（开发直接取用）

定义在 `Lingyu UI 原型.html` 的 `<style>` 顶部 `:root` / `html[data-theme="light"]`。

### 色彩（深色为主，浅色为同色系翻转）

| token | 深色值 | 用途 |
|---|---|---|
| `--bg` | `#0a0d14` | 页面底色（墨蓝黑） |
| `--bg-elev` | `rgba(255,255,255,.045)` | 玻璃面板底 |
| `--bg-elev-2` | `rgba(255,255,255,.09)` | 控件底 / hover |
| `--bg-solid` | `rgba(17,21,31,.92)` | 抽屉、Toast 等实底浮层 |
| `--border` / `--border-strong` | `rgba(255,255,255,.09)` / `.17` | 分隔线 / 浮层描边 |
| `--text` / `--text-2` / `--text-3` | `rgba(233,238,250,.94/.62/.38)` | 主文 / 次文 / 弱文 |
| `--accent` | `#8b7cff` | 主强调（靛紫） |
| `--accent-2` | `#46c8ff` | 次强调（青），用于渐变终点 |
| `--accent-grad` | `135deg #8b7cff → #46c8ff` | 品牌标 / 主按钮 / 激活态 |
| `--accent-soft` / `--accent-border` | `rgba(139,124,255,.16/.42)` | 强调底 / 强调描边 |
| `--ok` / `--warn` / `--err` | `#3ecf9a` / `#f5b74e` / `#ff7a76` | 成功 / 警示 / 错误（各配 `-soft`） |
| `--mark-bg` | `rgba(139,124,255,.2)` | 语法改动高亮底色 |
| `--glow-a` / `--glow-b` | 紫 / 青径向光晕 | 背景氛围光（blur 90px） |

浅色主题：`--bg #eef0f6` 纸面、`--accent #6d5ae8`、文字 `#171d2e`，其余同构。

### 字体

```
--font-ui: -apple-system, "SF Pro Text", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif
--font-display: "Space Grotesk", var(--font-ui)   /* 品牌 Logo、标题字 */
--font-mono: ui-monospace, "SF Mono", Menlo, monospace  /* 状态条、计数、徽标 */
```

中英混排统一走 UI 栈；正文行高 1.7–1.85（CJK 需要）；结果正文 15px/1.85。

### 形状与层级

| token | 值 | 用途 |
|---|---|---|
| `--radius-lg` | 20px | 主面板 |
| `--radius-md` | 12px | 卡片内块 / 输入框 |
| `--radius-sm` | 8px | 按钮 |
| `--blur` | `saturate(150%) blur(22px)` | 玻璃面板；浮层用 blur(30px) |
| `--shadow-panel` | `0 16px 48px rgba(0,0,0,.32)` | 面板 |
| `--shadow-pop` | `0 24px 64px rgba(0,0,0,.5)` | 抽屉 / 弹窗 / Toast |

面板统一带 `inset 0 1px 0 rgba(255,255,255,.05)` 顶部内高光，是玻璃质感的关键一笔。

### 布局

- 宽 ≥960px：左右双栏（原文 | 结果），`grid 1fr 1fr / gap 14px`
- 窄 <960px：上下堆叠（结果可滚动）
- 顶栏：品牌 → 模式分段控件（翻译/语法检查/润色）→ 空隙 → 剪贴板状态 pill / 用量 pill / 图标按钮

## 关键交互规范（与功能方案一一对应）

1. **激活即处理**：`simulateFocus()` 演示「切回窗口 → 读剪贴板 → 过滤（链接/过短跳过）→ 防重（同文本 5 分钟内跳过）→ 按上次模式自动处理 → 结果自动写回剪贴板」的完整状态机。
2. **模式记忆**：上次使用的模式存 `localStorage`（`ly_mode`），顶栏分段控件切换后若已有结果会按新模式自动重跑。
3. **改动高亮**：语法检查的修正文本用 `mark.ly-diff` 高亮（来自 changes 列表的 revised 串匹配），悬停显示理由；润色默认纯文本，「显示改动」展开逐条说明。
4. **错误态**：超长（红条 + 字符计数变红）、额度用尽（429 卡片 + 用量 pill 变红）、剪贴板未授权（顶栏 pill 变琥珀、降级示例文本），全部可从「演示控制」触发。
5. **历史 / 设置**：右侧抽屉；历史可按模式过滤、单删、清空、点选回填；设置含自动读取 / 自动复制开关、说明语言、模型选择（Qwen2.5-72B 默认 / Llama-3.1-8B 轻快）、深浅色。

## 文件结构

```
designs/lingyu/
├── Lingyu UI 原型.html   # 入口：token CSS + CDN 引用 + 错误自检浮层
├── icons.jsx            # 线性图标库（stroke 1.7）
├── data.jsx             # 示例文本 / 演示 AI 返回 / 语言检测 / diff 分段
├── panes.jsx            # 展示组件（面板、抽屉、锁屏、Toast、演示面板）
├── app.jsx              # 状态编排（剪贴板闭环、防重、历史、额度模拟）
└── README.md
```

原型局限（评审时请知悉）：AI 返回为预置演示数据；任意自行粘贴的文本会回填同语言示例结果并标注「演示数据」chip；改动说明目前只有中文文案。

## 评审用 URL 参数

`?demo=1` 直达工作台（跳过锁屏与引导、不触发真实剪贴板读取、结果直接标记「已写回剪贴板」），可叠加：

| 参数 | 取值 | 示例 |
|---|---|---|
| `mode` | translate / grammar / polish | `&mode=grammar` |
| `sample` | s1（中译英）/ s2（英文检查）/ s3（英文润色）/ s4（中文检查）/ long（超长）/ url（跳过） | `&sample=s2` |
| `theme` | dark / light | `&theme=light` |
| `quota` | 1（额度用尽） | `&quota=1` |

例如：`http://localhost:4311/lingyu/Lingyu%20UI%20%E5%8E%9F%E5%9E%8B.html?demo=1&mode=grammar&sample=s2`
