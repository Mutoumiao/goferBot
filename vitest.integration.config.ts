import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'
import path from 'path'
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
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './packages/server/src'),
      '@goferbot/server': path.resolve(__dirname, './packages/server/src'),
      '@goferbot/rag-sdk': path.resolve(__dirname, './packages/rag-sdk/src/index.ts'),
    },
  },
  test: {
    include: ['tests/integration/**/*.spec.ts', 'tests/issues/**/*.spec.ts'],
    exclude: [
      'tests/integration/legacy/**',
      'tests/integration/sidecar/**',
      'tests/issues/f-08*/**',
      'tests/issues/f-09*/**',
      'tests/issues/f-10*/**',
    ],
    pool: 'forks',
    reporters: [new AIReporter()],
    setupFiles: ['./tests/setup/integration-env.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
  },
})
