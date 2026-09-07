"""生产环境端到端验收（无头 Chromium + 真实剪贴板权限 + 真实 Workers AI）。

运行：/opt/homebrew/opt/python@3.11/bin/python3.11 scripts/e2e.py
可覆盖：E2E_BASE / E2E_PASSCODE 环境变量
"""
import os
import sys

from playwright.sync_api import sync_playwright

BASE = os.environ.get("E2E_BASE", "https://lingyu.haigr.workers.dev")
PASSCODE = os.environ.get("E2E_PASSCODE", "150613")
GRAMMAR_TEXT = (
    "Me and my colleague was reviewing the deploy log this morning, and we finded "
    "several errors which could of been avoided if the config was checked more careful."
)
ZH_TEXT = "我们决定把发布推迟到下周三，因为还有两个关键问题没解决，明天上午我会同步具体计划。"

passed = 0


def ok(label: str, extra: str = "") -> None:
    global passed
    passed += 1
    line = f"OK  {label}"
    if extra:
        line += f" — {extra}"
    print(line)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 1440, "height": 900},
        permissions=["clipboard-read", "clipboard-write"],
        locale="zh-CN",
    )
    page = context.new_page()
    page.on("pageerror", lambda e: print("[pageerror]", e))
    page.set_default_timeout(45000)

    # 1. 锁屏
    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_selector(".lock-card")
    ok("1. 生产站锁屏渲染")

    # 2. 错误口令被拒
    page.fill(".lock-input", "000000")
    page.click(".lock-btn")
    page.wait_for_selector(".lock-input.err")
    ok("2. 错误口令被拒绝")

    # 3. 正确口令解锁 → 首次引导
    page.fill(".lock-input", PASSCODE)
    page.click(".lock-btn")
    page.wait_for_selector(".modal-card")
    ok("3. 解锁成功，首次引导出现")

    # 4. 剪贴板放英文错误文本，关闭引导 → 自动读取 + 默认翻译模式
    page.evaluate("t => navigator.clipboard.writeText(t)", GRAMMAR_TEXT)
    page.click(".modal-card .btn.accent")
    page.wait_for_selector(".result-text", timeout=90000)
    result1 = (page.text_content(".result-text") or "").strip()
    active_mode = (page.text_content(".mode-tab.active") or "").strip()
    if not ("同事" in result1 or "部署" in result1 or "错误" in result1):
        raise RuntimeError(f"翻译结果异常: {result1[:120]}")
    ok("4. 激活后自动读取剪贴板并处理（英→中）", f"模式={active_mode}，结果={result1[:56]}…")

    # 5. 结果自动写回剪贴板
    clip1 = page.evaluate("() => navigator.clipboard.readText()")
    if clip1.strip() == result1:
        ok("5. 结果已自动写回剪贴板")
    else:
        # 无头环境可能无焦点 → 走「切回补写」路径
        page.evaluate("() => window.dispatchEvent(new Event('focus'))")
        page.wait_for_timeout(900)
        clip1b = page.evaluate("() => navigator.clipboard.readText()")
        if clip1b.strip() != result1:
            raise RuntimeError(f"剪贴板写回失败: {clip1b[:90]}")
        ok("5. 焦点补写路径生效，结果已写入剪贴板")

    # 6. 防重：同一剪贴板内容再次激活 → 提示跳过
    page.evaluate("() => window.dispatchEvent(new Event('focus'))")
    page.wait_for_selector(".toast", timeout=8000)
    toast = (page.text_content(".toast") or "").strip()
    if ("相同" not in toast) and ("跳过" not in toast):
        raise RuntimeError(f"防重提示异常: {toast}")
    ok("6. 防重生效", toast)

    # 7. 新中文内容 + 焦点事件（模拟从其他 App 切回）→ 按当前翻译模式中译英
    page.evaluate("t => navigator.clipboard.writeText(t)", ZH_TEXT)
    page.evaluate("() => window.dispatchEvent(new Event('focus'))")
    page.wait_for_function(
        """() => {
            const t = document.querySelector('.result-text')?.textContent || '';
            return t.includes('Wednesday') || t.includes('delay') || t.includes('postpone') || t.includes('push');
        }""",
        timeout=90000,
    )
    result2 = (page.text_content(".result-text") or "").strip()
    ok("7. 切回窗口自动处理新内容（中→英）", result2[:56] + "…")

    # 8. 换回英文错误文本并切到语法检查 → 自动重跑出现 diff 高亮与改动说明
    page.fill(".src-textarea", GRAMMAR_TEXT)
    page.click('.mode-tab:has-text("语法检查")')
    page.wait_for_selector("mark.ly-diff", timeout=90000)
    marks = page.locator("mark.ly-diff").count()
    change_items = page.locator(".change-item").count()
    if change_items == 0:
        raise RuntimeError("改动说明为空")
    ok("8. 语法检查：diff 高亮 + 改动说明", f"{marks} 处高亮 / {change_items} 条说明")

    # 9. 用量徽标
    usage_pill = (page.locator(".topbar .pill").nth(1).text_content() or "").strip()
    if "AI 用量" not in usage_pill:
        raise RuntimeError(f"用量徽标异常: {usage_pill}")
    ok("9. 用量徽标", usage_pill)

    # 10. 历史记录
    page.click('.icon-btn[aria-label="历史记录"]')
    page.wait_for_selector(".h-item")
    h_count = page.locator(".h-item").count()
    if h_count < 2:
        raise RuntimeError(f"历史应至少 2 条，实际 {h_count}")
    ok("10. 历史记录", f"{h_count} 条")
    page.click('.drawer .icon-btn[aria-label="关闭"]')

    # 11. 超长文本客户端拦截
    page.fill(".src-textarea", "测" * 4100)
    page.wait_for_selector(".char-count.over")
    if not page.locator(".panel-foot .btn.accent").first.is_disabled():
        raise RuntimeError("超限时运行按钮应禁用")
    ok("11. 超过 4000 字符：计数变红 + 运行禁用")

    browser.close()

print(f"\n全部通过：{passed} 项断言")
sys.exit(0)
