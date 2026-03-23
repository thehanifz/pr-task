import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// =============================================
// Ganti PORT sesuai kebutuhan kamu
// =============================================
const PORT = 7465

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: PORT,
    allowedHosts: [
      ".thehanifz.fun",
    ],
    strictPort: true
  },
  preview: {
    host: '0.0.0.0',
    port: PORT,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia']
        }
      }
    }
  }
})
