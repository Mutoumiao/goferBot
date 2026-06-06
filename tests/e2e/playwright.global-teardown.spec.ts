import { describe, it, expect } from 'vitest'

describe('globalTeardown', () => {
  it('AC-01: 导入 globalTeardown 模块不报错', async () => {
    const mod = await import('./playwright.global-teardown')
    expect(typeof mod.default).toBe('function')
  })
})
