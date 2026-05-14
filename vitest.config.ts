import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./packages/webui/src', import.meta.url)),
      '@goferbot/shell-adapters': fileURLToPath(new URL('./packages/shellAdapters/dist/index.js', import.meta.url)),
      '@goferbot/backend-adapters': fileURLToPath(new URL('./packages/backendAdapters/dist/index.js', import.meta.url)),
      '@goferbot/rag-sdk': fileURLToPath(new URL('./packages/rag-sdk/dist/index.js', import.meta.url)),
    },
  },
  test: {
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'tests/e2e-full/**', 'tests/integration/**', 'packages/**'],
    environment: 'happy-dom',
    setupFiles: ['./tests/setup/testglobals.ts'],
  },
})
