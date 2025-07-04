/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean
  readonly PROD: boolean
  readonly WORKER_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}