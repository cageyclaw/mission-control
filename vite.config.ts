import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    host: '0.0.0.0',
    allowedHosts: ['lcars.cageycloud.com', 'occ.cageycloud.com', 'localhost', '127.0.0.1'],
    proxy: {
      // Proxy gateway health endpoints
      '/healthz': {
        target: 'http://127.0.0.1:18789',
        changeOrigin: true,
      },
      '/readyz': {
        target: 'http://127.0.0.1:18789',
        changeOrigin: true,
      },
      // Proxy full status endpoint (requires proxy server running on 5181)
      '/api': {
        target: 'http://127.0.0.1:5181',
        changeOrigin: true,
      },
      // Proxy system metrics server
      '/metrics': {
        target: 'http://127.0.0.1:18790',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/metrics/, ''),
      },
    },
  },
})
