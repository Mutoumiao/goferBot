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
    pool: 'forks',
    maxForks: 1,
    minForks: 1,
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
  },
})
