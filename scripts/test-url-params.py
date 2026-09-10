"""URL 参数功能验证（本地 dev server）。

断言前端行为：mode 参数切换、text 参数载入、URL 参数清除、剪贴板监控暂停。
AI 调用结果不在本测试范围内（网络受限时可能超时），已由生产 E2E 覆盖。
"""
from urllib.parse import quote
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
PASSCODE = "test9999"
TEXT = "Me and my colleague was reviewing the deploy log and we finded several errors."

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 1440, "height": 900},
        locale="zh-CN",
        permissions=["clipboard-read", "clipboard-write"],
    )
    page = ctx.new_page()
    # 界面语言默认英文；本测试断言中文文案，故固定 uiLang=zh
    ctx.add_init_script(
        "localStorage.setItem('ly_settings', JSON.stringify("
        "{autoRead:true,autoCopy:true,model:'qwen3',explainLang:'zh',uiLang:'zh'}));"
        "localStorage.setItem('ly_onboarded','1');"
    )
    page.set_default_timeout(30000)
    page.on("pageerror", lambda e: print("[pageerror]", e))

    # ═══ 测试 1：mode + text 参数 ═══
    page.goto(f"{BASE}/?mode=grammar&text={quote(TEXT)}", wait_until="domcontentloaded")
    page.wait_for_selector(".lock-card")
    page.fill(".lock-input", PASSCODE)
    page.click(".lock-btn")

    # 等进入工作台（离线容错路径也算）
    page.wait_for_selector(".workbench", timeout=30000)
    page.wait_for_timeout(1200)

    mode_active = (page.text_content(".mode-tab.active") or "").strip()
    src = (page.input_value(".src-textarea") or "").strip()
    assert "语法检查" in mode_active, f"mode 参数未生效: {mode_active}"
    print(f"OK  1. mode=grammar 参数生效（当前模式：{mode_active}）")

    assert src == TEXT, f"text 参数未载入: {src[:60]}"
    print("OK  2. text 参数已载入原文框")

    assert "mode=" not in page.url and "text=" not in page.url, f"URL 参数未清除: {page.url}"
    print("OK  3. 处理后 URL 参数已清除（防刷新重复处理）")

    # 监控暂停验证：换成新剪贴板内容 + 触发 focus，不应覆盖原文
    page.evaluate("t => navigator.clipboard.writeText(t)", "BRAND NEW clipboard content that must be ignored.")
    page.evaluate("() => window.dispatchEvent(new Event('focus'))")
    page.wait_for_timeout(2500)
    src_after = (page.input_value(".src-textarea") or "").strip()
    assert src_after == TEXT, f"剪贴板监控未暂停: {src_after[:60]}"
    print("OK  4. text 参数模式下剪贴板监控已暂停")

    # 手动编辑应恢复监控
    page.fill(".src-textarea", "manual edit to re-enable monitoring")
    page.evaluate("() => window.dispatchEvent(new Event('focus'))")
    page.wait_for_timeout(2000)
    src_resumed = (page.input_value(".src-textarea") or "").strip()
    assert src_resumed != "manual edit to re-enable monitoring", "手动编辑后剪贴板监控未恢复"
    print(f"OK  5. 手动编辑后剪贴板监控恢复（读到：{src_resumed[:40]}）")

    # ═══ 测试 2：仅 mode 参数（无 text）═══
    page2 = ctx.new_page()
    page2.set_default_timeout(30000)
    page2.goto(f"{BASE}/?mode=polish", wait_until="domcontentloaded")
    page2.wait_for_selector(".workbench", timeout=30000)
    page2.wait_for_timeout(1500)
    mode2 = (page2.text_content(".mode-tab.active") or "").strip()
    assert "润色" in mode2, f"mode 参数（无 text）未生效: {mode2}"
    print(f"OK  6. 仅 mode=polish 生效（无 text 时走剪贴板路径，模式：{mode2}）")

    browser.close()

print("\nURL 参数功能验证全部通过")
