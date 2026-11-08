/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module 'sockjs-client'
declare module 'qrcode'

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_MAIN_SITE_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
