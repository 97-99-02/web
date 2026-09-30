import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 개발 중에는 /api 를 FastAPI(8000)로 넘긴다. 시연 때는 npm run build 후 FastAPI 한 곳에서 모두 띄운다.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
