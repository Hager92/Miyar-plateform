import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    open: false,
    // The I-DO engine (ido_dual_ai) ships without CORS middleware, so the browser would
    // block a direct cross-origin call. Proxying keeps it same-origin in dev and leaves
    // the reference service untouched. Override the target with ENGINE_ORIGIN.
    proxy: {
      '/engine-api': {
        target: process.env.ENGINE_ORIGIN || 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/engine-api/, ''),
        timeout: 15 * 60 * 1000, // a local GPU run can take minutes
        proxyTimeout: 15 * 60 * 1000,
      },
    },
  },
})
