import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./packages/webui/src', import.meta.url)),
      '@goferbot/rag-sdk': fileURLToPath(new URL('./packages/rag-sdk/src/index.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    include: ['tests/unit/server/vector-service.spec.ts', 'tests/unit/server/keyword-service.spec.ts', 'tests/unit/server/document-service.spec.ts'],
    environment: 'node',
  },
})
