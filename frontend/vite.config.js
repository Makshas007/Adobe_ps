import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/

const SERVER = 'https://periodic-tuition-dominant-join.trycloudflare.com'
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/upload': 'http://localhost:8001',
      '/edit': 'http://localhost:8001',
      '/result': 'http://localhost:8001',
      '/history': 'http://localhost:8001',
    },
  },
})
