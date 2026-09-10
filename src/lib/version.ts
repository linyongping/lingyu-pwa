/**
 * 当前运行版本（构建时注入，见 vite.config.ts 的 define）。
 * 与线上 /version.json 对比即可判断 App 是否是部署到的最新版本。
 */
export const APP_BUILD_ID: string = __APP_BUILD_ID__;
export const APP_BUILT_AT: string = __APP_BUILT_AT__;

export function formatBuiltAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface BuildInfo {
  id?: string;
  version?: string;
  sha?: string;
  builtAt?: string;
}

/** 拉取线上最新版本信息（加时间戳 + no-store，绕过 HTTP/SW 缓存）；失败返回 null */
export async function fetchDeployedBuild(): Promise<BuildInfo | null> {
  try {
    const resp = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) return null;
    return (await resp.json()) as BuildInfo;
  } catch {
    return null;
  }
}

/** 主动让 Service Worker 检查更新，然后重载拿到新产物 */
export async function activateUpdate(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
  } catch {
    // 不支持 SW 时直接重载即可
  }
  window.location.reload();
}
