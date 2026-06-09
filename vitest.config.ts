import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'
import AIReporter from 'vitest-ai-reporter'

export default defineConfig({
  resolve: {
    alias: {
      '@goferbot/rag-sdk': fileURLToPath(new URL('./packages/rag-sdk/src/index.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    include: ['tests/unit/server/**/*.spec.ts', 'tests/unit/server/**/*.test.ts'],
    exclude: [
      'tests/e2e/**',
      'tests/e2e-full/**',
      'tests/integration/**',
      'packages/webui/**',
      'packages/server/**',
    ],
    environment: 'happy-dom',
    setupFiles: ['./tests/setup/testglobals.ts'],
    reporters: [new AIReporter()],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary'],
      include: [
        'packages/rag-sdk/src/**/*.ts',
        'packages/server/src/**/*.ts',
      ],
      exclude: [
        'packages/rag-sdk/src/index.ts',
        'packages/server/src/main.ts',
      ],
    },
  },
})
