# 邻语 Lingyu — 剪贴板翻译台 PWA

> 自动部署已启用：push 到 main 分支即触发 Cloudflare Pages 构建。

粘贴即处理：中英翻译、语法检查、英文润色。激活窗口自动读取剪贴板 → 按上次模式处理 → 结果自动写回剪贴板。

**线上地址**：https://lingyu.haigr.workers.dev （口令保护，向所有者索取）

## 技术栈

- **前端**：Vite + React 18 + TypeScript，设计 token 见 [designs/lingyu/README.md](designs/lingyu/README.md)
- **后端**：Cloudflare Worker（同域托管静态资源 + `/api/*`），Workers AI 免费额度
- **PWA**：vite-plugin-pwa（Service Worker 预缓存壳 + manifest + 图标）
- **存储**：历史记录 IndexedDB（本地，最多 200 条）；每日用量 Durable Object 原子计数（硬限 3000 次/天，KV 作为未绑定时的回退）
- **口令**：Worker secret `PASSCODE`，`X-Passcode` 头 + 常数时间比对

## 用量计数

每日额度计数走 Durable Object `UsageCounter`（[worker/usage.ts](worker/usage.ts)）：单实例 + `storage.transaction()` 保证「读-改-写」原子，并发请求不会各读旧值再各写 +1，因此不会少计、不会突破每日上限。

- 绑定：`wrangler.jsonc` 的 `durable_objects` / `migrations`（`new_sqlite_classes`）。
- 回退：若 `USAGE_DO` 未绑定或调用异常，自动回退到 `USAGE_KV`。**KV 无原子自增，高并发下为近似值（方向为少计）**，仅作兜底；正常部署请保留 DO 绑定。
- 计数按 UTC 日期分桶，跨天归零；只有模型成功返回后才 +1（失败的请求不占额度）。

## 模型（Workers Free 套餐实测可用）

| key | 模型 ID | 定位 |
|---|---|---|
| `qwen3` | `@cf/qwen/qwen3-30b-a3b-fp8` | 默认 · 快速、省额度 |
| `qwen3_8` | `@cf/qwen/qwen3.8-27b` | 旗舰 · 质量优先 |
| `m2m100` | `@cf/meta/m2m100-1.2b` | 翻译专用 · 仅翻译模式可用（其它模式自动回退到默认模型） |
| `llama32_1b` | `@cf/meta/llama-3.2-1b-instruct` | 极速 · 仅适合简单翻译 |

> 模型 key 与前端可选列表见 [src/lib/types.ts](src/lib/types.ts) 的 `MODEL_INFO`，服务端白名单见 [worker/prompts.ts](worker/prompts.ts) 的 `MODELS`。
> 以上 ID 已对照 Cloudflare 官方模型目录核实；`m2m100` 走翻译接口 `{text, source_lang, target_lang}`，返回 `translated_text`。

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
