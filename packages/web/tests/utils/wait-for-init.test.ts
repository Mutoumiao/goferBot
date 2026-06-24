import { describe, expect, it } from 'vitest'

// ponytail: 测试 waitForAuthInit 函数
// 注意：此测试需要模拟 Zustand store

describe('waitForAuthInit', () => {
  it('should export waitForAuthInit function', async () => {
    const { waitForAuthInit } = await import('@/utils/wait-for-init')
    expect(typeof waitForAuthInit).toBe('function')
  })

  it('should accept maxMs parameter', async () => {
    const { waitForAuthInit } = await import('@/utils/wait-for-init')
    // ponytail: 参数验证
    const fn = () => waitForAuthInit(5000)
    expect(fn).not.toThrow()
  })
})
