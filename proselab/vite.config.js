import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      // Proxy Galaxy AI API calls to avoid CORS in dev
      '/api/galaxy': {
        target: 'https://api.galaxy.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/galaxy/, '/api/v1'),
        secure: true
      },
      '/api/ingestion': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ingestion/, ''),
      }
    }
  }
})
