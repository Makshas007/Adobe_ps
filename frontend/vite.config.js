import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/upload': 'http://127.0.0.1:8001',
      '/edit': 'http://127.0.0.1:8001',
      '/result': 'http://127.0.0.1:8001',
      '/history': 'http://127.0.0.1:8001',
    },
  },
})
