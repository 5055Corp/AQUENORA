import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// https://vite.dev/config/
// Which build this is (newest wins for live updates). Set BUILD_ID, or it's the build time (UTC).
const BUILD_ID = process.env.BUILD_ID || new Date().toISOString().replace(/\D/g, '').slice(0, 14)

export default defineConfig({
  plugins: [react()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  // Relative asset paths, so the build works under GitHub Pages' /AQUENORA/ sub-path as well as at a root domain.
  base: './',
  build: {
    rollupOptions: {
      // Two pages: the seller app (index.html) and the public store page buyers see (store.html).
      input: {
        main: resolve(__dirname, 'index.html'),
        store: resolve(__dirname, 'store.html'),
        // The seller interview (market research): app.aquenora.com/interview
        interview: resolve(__dirname, 'interview.html'),
      },
    },
  },
})
