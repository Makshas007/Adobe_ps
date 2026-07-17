import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/

const SERVER = 'https://expenditures-limits-alter-wifi.trycloudflare.com'
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/upload': SERVER,
      '/edit': SERVER,
      '/result': SERVER,
      '/history': SERVER,
    },
  },
})
