import { fileURLToPath, URL } from 'node:url'
import { mergeConfig } from 'vite'
import { defineConfig } from 'vitest/config'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { version as pkgVersion } from './package.json'
import viteConfig from './vite.config'

process.env.VITE_APP_VERSION = pkgVersion
if (process.env.NODE_ENV === 'production') {
  process.env.VITE_APP_BUILD_EPOCH = new Date().getTime().toString()
}

const filteredPlugins =
  viteConfig.plugins?.filter((p: unknown) => {
    const plugin = p as { name?: string }
    return plugin?.name !== 'vite-plugin-node-polyfills'
  }) ?? []

export default mergeConfig(
  { ...viteConfig, plugins: filteredPlugins },
  defineConfig({
    plugins: [
      nodePolyfills({
        exclude: ['fs', 'path', 'os'],
      }),
    ],
    test: {
      globals: true,
      include: ['tests/unit/**/*.test.ts', 'src/**/*.spec.ts', '../../tests/unit/webui/**/*.spec.ts'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      environment: 'happy-dom',
      setupFiles: ['./tests/setup/testglobals.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'json-summary'],
        include: ['src/**/*.ts', 'src/**/*.vue'],
        exclude: ['src/main.ts'],
        thresholds: {
          lines: 70,
          functions: 60,
          branches: 55,
          statements: 70,
        },
      },
    },
  })
)
