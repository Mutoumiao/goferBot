import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import AIReporter from 'vitest-ai-reporter'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./packages/webui/src', import.meta.url)),
      '@goferbot/rag-sdk': fileURLToPath(new URL('./packages/rag-sdk/src/index.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.spec.ts'],
    exclude: [
      'tests/e2e/**',
      'tests/e2e-full/**',
      'tests/integration/**',
      // 排除 packages/ 但保留 rag-sdk，以便测试可以引用其源码
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
        'packages/webui/src/**/*.ts',
        'packages/webui/src/**/*.vue',
        'packages/rag-sdk/src/**/*.ts',
      ],
      exclude: ['packages/webui/src/main.ts', 'packages/rag-sdk/src/index.ts'],
      thresholds: {
        lines: 70,
        functions: 60,
        branches: 55,
        statements: 70,
      },
    },
  },
})
