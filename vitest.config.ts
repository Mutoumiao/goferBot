import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import AIReporter from 'vitest-ai-reporter'

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
    include: ['tests/unit/**/*.test.ts', 'tests/issues/**/*.spec.ts'],
    exclude: [
      'tests/e2e/**',
      'tests/e2e-full/**',
      'tests/integration/**',
      'tests/issues/b-*/**',
      'tests/issues/i-*/**',
      'packages/**',
    ],
    environment: 'happy-dom',
    setupFiles: ['./tests/setup/testglobals.ts'],
    reporters: [new AIReporter()],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary'],
      include: ['packages/webui/src/**/*.ts', 'packages/webui/src/**/*.vue'],
      exclude: ['packages/webui/src/main.ts'],
      thresholds: {
        lines: 70,
        functions: 60,
        branches: 55,
        statements: 70,
      },
    },
  },
})
