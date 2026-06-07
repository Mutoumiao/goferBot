import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@goferbot/data': fileURLToPath(new URL('../data/src/types/index.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    include: ['tests/**/*.spec.ts', 'tests/**/*.test.ts'],
    environment: 'happy-dom',
  },
})
