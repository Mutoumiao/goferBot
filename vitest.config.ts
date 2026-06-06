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
        'packages/server/src/**/*.ts',
      ],
      exclude: [
        'packages/webui/src/main.ts',
        'packages/rag-sdk/src/index.ts',
        'packages/server/src/main.ts',
      ],
      // 阶段 1（当前）：仅报告覆盖率，不阻断 CI
      // 原因：后端代码刚纳入 coverage（q-27），大量模块尚未补齐测试
      // 恢复条件：后端整体覆盖率达到门槛（行 60%/函数 50%/分支 40%/语句 60%）
      // TODO: 阶段 2 恢复 thresholds 并改为 warning 模式，阶段 3 改为阻断模式
      // thresholds: {
      //   lines: 60,
      //   functions: 50,
      //   branches: 40,
      //   statements: 60,
      // },
    },
  },
})
