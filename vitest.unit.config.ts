/**
 * 单元测试专用 Vitest 配置（不依赖集成测试/真实 DB）。
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/unit/**/*.spec.ts'],
    environment: 'node',
  },
})
