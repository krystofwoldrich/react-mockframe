import { defineConfig, type Plugin } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

/**
 * The playground's reference frames (reference-frames/, see its README) are Apple's and Google's artwork that
 * you add on your own computer. Only the dev server reads that folder: in a production build the module is
 * empty, so a deployed site never contains the images.
 */
function referenceFrames(): Plugin {
  const id = 'virtual:reference-frames'
  let serve = false
  return {
    name: 'reference-frames',
    configResolved(config) {
      serve = config.command === 'serve'
    },
    resolveId(source) {
      return source === id ? `\0${id}` : undefined
    },
    load(loaded) {
      if (loaded !== `\0${id}`) return undefined
      return serve
        ? "export const images = import.meta.glob('/reference-frames/**/*.{png,webp,jpg,jpeg}', { query: '?url', import: 'default' })\n" +
          "export const layouts = import.meta.glob('/reference-frames/**/layout', { query: '?raw', import: 'default' })\n"
        : 'export const images = {}\nexport const layouts = {}\n'
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    referenceFrames(),
  ],
  resolve: {
    alias: {
      '@krystofs/device-frames/styles/mockframe.css': resolve(__dirname, '../package/dist/styles/mockframe.min.css'),
      '@krystofs/device-frames': resolve(__dirname, '../package'),
    },
  },
})
