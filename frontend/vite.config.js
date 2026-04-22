import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000', // 后端服务器地址，部署时需要修改为实际服务器地址
        changeOrigin: true
      }
    }
  }
})