import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'
import AIReporter from 'vitest-ai-reporter'

// 根 config 职责：跨包别名 + 全局 setup
// 各包单元测试由 packages/{web,server,rag-sdk}/vitest.config.ts 独立运行
// 集成测试由 vitest.integration.config.ts 独立运行
export default defineConfig({
  resolve: {
    alias: {
      '@server': fileURLToPath(new URL('./packages/server/src', import.meta.url)),
      '@web': fileURLToPath(new URL('./packages/web/src', import.meta.url)),
      '@rag-sdk': fileURLToPath(new URL('./packages/rag-sdk/src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    include: [],  // 包内单元测试由各自 config 运行
    exclude: [
      'tests/e2e/**',
      'tests/integration/**',
      'packages/webui/**',
      'node_modules/**',
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
