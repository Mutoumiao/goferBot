import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'
import path from 'path'

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        target: 'es2021',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './packages/server/src'),
      '@goferbot/server': path.resolve(__dirname, './packages/server/src'),
      '@goferbot/rag-sdk': path.resolve(__dirname, './packages/rag-sdk/src/index.ts'),
    },
  },
  test: {
    include: ['tests/e2e/api/**/*.spec.ts'],
    // 当前无测试文件，允许空套件通过
    // TODO: 添加第一批 API E2E 测试后移除此配置
    passWithNoTests: true,
    pool: 'forks',
    testTimeout: 60000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
  },
})
