import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// 백엔드 주소. 기본은 8080. 다른 포트에 띄운 백엔드에 붙일 때는 VITE_PROXY_TARGET 으로 바꾼다.
const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|@remix-run)\//.test(id)) return 'react'
          if (/node_modules\/(react-markdown|remark|rehype|mdast|micromark|unified|hast|unist|vfile|decode-named|character-|property-information|space-separated|comma-separated|bail|trough|devlop|html-url|is-plain|ccount|estree|markdown-table|zwitch|longest-streak|trim-lines|style-to-|inline-style|stringify-entities|parse-entities)/.test(id)) return 'markdown'
          return undefined
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        // 브라우저의 POST 요청에는 Origin(예: http://localhost:3100)이 붙는데, 백엔드 CORS 허용 목록에
        // 없는 포트면 Spring 이 403 으로 거절한다. dev proxy 는 같은 출처처럼 보내도록 Origin 을 제거한다.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin')
          })
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
