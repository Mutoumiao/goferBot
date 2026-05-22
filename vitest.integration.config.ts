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
    },
  },
  test: {
    include: ['tests/integration/**/*.spec.ts', 'tests/issues/**/*.spec.ts'],
    exclude: ['tests/integration/legacy/**', 'tests/integration/sidecar/**'],
    pool: 'forks',
    setupFiles: ['./tests/setup/integration-env.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
  },
})
