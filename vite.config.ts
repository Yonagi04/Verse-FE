import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  define: {
    global: 'globalThis',
  },
  plugins: [
    vue(),
    {
      name: 'verse-reconciliation-entry',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.headers.host?.split(':')[0] === 'reconciliation.localhost'
            && req.method === 'GET' && /^\/[A-Za-z][A-Za-z0-9]{7}(?:\?.*)?$/.test(req.url ?? '')) {
            req.url = '/reconciliation.html'
          }
          next()
        })
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        reconciliation: fileURLToPath(new URL('./reconciliation.html', import.meta.url)),
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // 仅代理 /api/v1，避免 /api-keys 等前端路由被误代理到后端导致刷新 401
      '/api/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        loadPaths: [fileURLToPath(new URL('./src', import.meta.url))],
        additionalData: `@use "assets/styles/variables" as *;\n`,
      },
    },
  },
})
