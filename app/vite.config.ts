import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the build works under GitHub Pages' /AQUENORA/ sub-path as well as at a root domain.
  base: './',
  build: {
    rollupOptions: {
      // Two pages: the seller app (index.html) and the public store page buyers see (store.html).
      input: {
        main: resolve(__dirname, 'index.html'),
        store: resolve(__dirname, 'store.html'),
      },
    },
  },
})
