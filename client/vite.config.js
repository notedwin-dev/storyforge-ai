import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    cors: {
      origin: [
        'http://localhost:5173',
        'https://www.soundjay.com',
        'https://api.elevenlabs.io'
      ],
      credentials: true
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      '/demo': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
