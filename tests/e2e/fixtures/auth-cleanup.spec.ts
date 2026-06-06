import { describe, it, expect } from 'vitest'
import { cleanupDatabase } from './database'

describe('autoCleanup fixture', () => {
  it('AC-03: cleanupDatabase 可被直接导入并调用', async () => {
    await expect(cleanupDatabase()).resolves.not.toThrow()
  })
})
