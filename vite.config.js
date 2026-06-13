// vite.config.js
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],

  preview: {
    host: "127.0.0.1",
    port: 3001,
    allowedHosts: ["synchaura.dpdns.org"],
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    },
  },

  define: {
    global: 'window',
  },
  optimizeDeps: {
    include: ['pouchdb/dist/pouchdb.js']
  }
});