import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.spec.ts', 'tests/issues/**/*.spec.ts'],
    exclude: ['tests/integration/legacy/**', 'tests/integration/sidecar/**'],
    pool: 'forks',
    testTimeout: 60000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
  },
})
