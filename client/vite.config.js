import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Base public path. '/' for local dev, custom domains, and Vercel; the GitHub
  // Pages workflow sets BASE_PATH=/Carports/ so assets resolve under the repo path.
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
