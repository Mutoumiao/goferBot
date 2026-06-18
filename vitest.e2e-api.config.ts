import path from 'path'
import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'
import AIReporter from 'vitest-ai-reporter'

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
  esbuild: false,
  oxc: false,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './packages/server/src'),
      '@server': path.resolve(__dirname, './packages/server/src'),
      '@goferbot/server': path.resolve(__dirname, './packages/server/src'),
      '@rag-sdk': path.resolve(__dirname, './packages/rag-sdk/src'),
      '@goferbot/rag-sdk': path.resolve(__dirname, './packages/rag-sdk/src/index.ts'),
    },
  },
  test: {
    include: ['tests/e2e/api/**/*.spec.ts'],
    pool: 'forks',
    reporters: [new AIReporter()],
    setupFiles: ['./tests/setup/integration-env.ts'],
    globalSetup: ['./tests/setup/test-db-teardown.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
  },
})
