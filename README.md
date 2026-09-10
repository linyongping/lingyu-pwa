# 邻语 Lingyu — 剪贴板翻译台 PWA

> 自动部署已启用：push 到 main 分支即触发 Cloudflare Pages 构建。

粘贴即处理：中英翻译、语法检查、英文润色。激活窗口自动读取剪贴板 → 按上次模式处理 → 结果自动写回剪贴板。

**线上地址**：https://lingyu.haigr.workers.dev （口令保护，向所有者索取）

## 技术栈

- **前端**：Vite + React 18 + TypeScript，设计 token 见 [designs/lingyu/README.md](designs/lingyu/README.md)
- **后端**：Cloudflare Worker（同域托管静态资源 + `/api/*`），Workers AI 免费额度
- **PWA**：vite-plugin-pwa（Service Worker 预缓存壳 + manifest + 图标）
- **存储**：历史记录 IndexedDB（本地，最多 200 条）；每日用量 KV（服务端计数，硬限 3000 次/天）
- **口令**：Worker secret `PASSCODE`，`X-Passcode` 头 + 常数时间比对

## 模型（Workers Free 套餐实测可用）

| key | 模型 ID | 定位 |
|---|---|---|
| `glm` | `@cf/zai-org/glm-4.7-flash` | 默认 · 质量优先，中英最佳 |
| `qwen3` | `@cf/qwen/qwen3-30b-a3b-fp8` | 轻快 · 更省额度 |

> 注：`@cf/zai-org/glm-5.3-flash`、旧 Qwen2.5 与 Llama-3.1 已不可用 / 已弃用（2026-09 实测 GLM-5.3-Flash 报 5035 仅付费可用）。

## URL 参数

| 参数 | 取值 | 说明 |
|---|---|---|
| `mode` | `translate` / `grammar` / `polish` | 指定本次使用的功能模式 |
| `text` | 任意文本（URL 编码） | **最高优先级**：直接处理该文本，暂停剪贴板监控；处理完自动清除参数 |

示例：

```
https://lingyu.haigr.workers.dev/?mode=grammar&text=Me%20and%20my%20colleague%20was%20reviewing
https://lingyu.haigr.workers.dev/?mode=polish
```

配合浏览器书签或快捷指令（iOS Shortcuts / Raycast / Alfred）可做成一键翻译/检查入口。
手动编辑原文框会恢复剪贴板监控。

## 开发

```bash
npm install
npm run dev        # http://localhost:5173（worker + 前端一体，远程绑定连真实 AI/KV）
npm run icons      # 重新生成 PWA 图标（需改 public/icon.svg 后执行）
npm run check      # TypeScript
npm run build      # 类型检查 + 产物构建
```

本地口令在 `.dev.vars`（与线上口令保持一致）。

## 部署

```bash
npm run deploy     # 构建并 wrangler deploy（自动使用 dist/lingyu/wrangler.json）
```

修改口令：`echo "新口令" | npx wrangler secret put PASSCODE`

## 端到端验收

```bash
/opt/homebrew/opt/python@3.11/bin/python3.11 scripts/e2e.py
# 对生产站跑 11 项断言：锁屏/口令/引导/自动读取/写回/防重/方向识别/语法高亮/用量/历史/超长拦截
# 需 homebrew 的 playwright（chromium headless shell）；可用 E2E_BASE / E2E_PASSCODE 覆盖目标
```

## API

- `GET /api/usage` → `{ used, limit, date }`
- `POST /api/process` body `{ mode, text, direction?, style?, customPrompt?, explainLang?, model? }`
  → `{ result, changes|null, detectedLang, direction|null, model, usage }`
  错误：`401 invalid_passcode` / `422 too_long`（>4000 字符）/ `429 quota_exceeded` / `502 ai_error`

两条接口都要求 `x-passcode` 头。
