import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/vgena/',
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Copy index.html to 404.html for SPA routing on GitHub Pages
    rollupOptions: {
      input: {
        main: 'index.html',
      },
    },
  },
  // SPA fallback for dev server
  preview: {
    port: 3000,
  },
})
