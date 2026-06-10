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
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    include: ['tests/**/*.spec.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
})
