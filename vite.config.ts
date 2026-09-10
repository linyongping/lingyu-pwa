import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * 构建标识：版本号 + git 短 SHA。用于在 App 上显示当前运行版本，
 * 并与线上 /version.json 对比判断是否需要刷新到最新版本。
 */
function readBuildInfo() {
  let sha = "dev";
  try {
    sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || "dev";
  } catch {
    // 非 git 环境（源码打包部署等）退化为 dev
  }
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version?: string };
  const version = pkg.version ?? "0.0.0";
  return { id: `${version}+${sha}`, version, sha, builtAt: new Date().toISOString() };
}

const buildInfo = readBuildInfo();
// 随产物发布的版本文件（public/ 会原样复制进客户端构建目录），供前端运行时比对
writeFileSync("public/version.json", JSON.stringify(buildInfo, null, 2) + "\n");

export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildInfo.id),
    __APP_BUILT_AT__: JSON.stringify(buildInfo.builtAt),
  },
  plugins: [
    react(),
    cloudflare(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"],
      manifest: {
        name: "邻语 Lingyu — 剪贴板翻译台",
        short_name: "邻语",
        description: "粘贴即处理：中英翻译、语法检查、英文润色，结果自动写回剪贴板。",
        lang: "zh-CN",
        dir: "ltr",
        display: "standalone",
        start_url: "/",
        scope: "/",
        orientation: "any",
        background_color: "#0a0d14",
        theme_color: "#0a0d14",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts", expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
