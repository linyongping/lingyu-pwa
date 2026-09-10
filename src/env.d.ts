/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** 构建时由 vite.config.ts 注入，见 src/lib/version.ts */
declare const __APP_BUILD_ID__: string;
declare const __APP_BUILT_AT__: string;
