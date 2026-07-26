import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
  base: '/tattoo-editor-demo/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // poly2tri's UMD wrapper checks for a Node-style `global` - doesn't exist in the browser.
  define: {
    global: 'globalThis',
  },
})

