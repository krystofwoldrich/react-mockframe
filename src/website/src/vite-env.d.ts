/// <reference types="vite/client" />

/** Reference frame files by path below the site root (empty in a production build, see vite.config.mts) */
declare module 'virtual:reference-frames' {
  export const images: Record<string, () => Promise<string>>
  export const layouts: Record<string, () => Promise<string>>
}
