import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const host = process.env.TAURI_DEV_HOST
const webBuild = process.env.CC_HAHA_BUILD_TARGET === 'web'

export default defineConfig({
  base: webBuild ? '/' : './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: webBuild ? 'web-dist' : 'dist',
    // Vite 8 defaults to baseline-widely-available (safari16.4+), which
    // requires macOS 13+. Tauri on macOS 12 uses Safari 15 WebView.
    target: ['es2021', 'safari15'],
    chunkSizeWarningLimit: 2200,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'INEFFECTIVE_DYNAMIC_IMPORT') return
        warn(warning)
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
})
