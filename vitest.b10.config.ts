import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./packages/webui/src', import.meta.url)),
      '@goferbot/shell-adapters': fileURLToPath(new URL('./packages/shellAdapters/dist/index.js', import.meta.url)),
      '@goferbot/backend-adapters': fileURLToPath(new URL('./packages/backendAdapters/dist/index.js', import.meta.url)),
      '@goferbot/rag-sdk': fileURLToPath(new URL('./packages/rag-sdk/src/index.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    include: ['tests/issues/b-10-server-vector-keyword-adapters/**/*.spec.ts'],
    environment: 'node',
  },
})
