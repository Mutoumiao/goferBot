import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: '@', replacement: path.resolve(__dirname, './src') }],
  },
  test: {
    globals: true,
    include: [
      'tests/**/*.spec.ts',
      'tests/**/*.spec.tsx',
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
    ],
    // ponytail: Windows 下 happy-dom + React 测试在默认 threads/并行模式会引发 worker 崩溃；
    // 显式使用 forks 并串行执行以保证测试可稳定退出
    pool: 'forks',
    fileParallelism: false,
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', 'tests/**', '**/*.config.*', '**/*.d.ts', '**/*.md'],
      thresholds: {
        // ponytail: 设置 80% 覆盖率阈值
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})
