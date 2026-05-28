import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./packages/webui/src', import.meta.url)),
    },
  },
  test: {
    name: 'f-16',
    include: ['tests/unit/webui/KbSelector.spec.ts', 'tests/unit/webui/ChatView.spec.ts', 'tests/unit/webui/ChatInput.spec.ts'],
    environment: 'jsdom',
    globals: true,
  },
})
