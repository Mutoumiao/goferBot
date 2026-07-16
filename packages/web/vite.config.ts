import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

const isVitest = process.env.VITEST === '1'

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  plugins: [
    ...(isVitest
      ? []
      : [
          devtools(),
          nitro({ rollupConfig: { external: [/^@sentry\//] } }),
          tanstackStart({ spa: { enabled: true } }),
        ]),
    tailwindcss(),
    viteReact(),
  ],
  server: {
    // 监听 0.0.0.0，便于本机 127.0.0.1 / FRP 等反向代理连入（仅绑 ::1 时 127.0.0.1 会失败）
    host: true,
    port: 1420,
  },
  build: {
    target: 'esnext',
  },
})

export default config
