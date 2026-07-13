/**
 * 黄金测试：注入/窗口限额常量与 gap-matrix 对齐
 */
import { describe, expect, it } from 'vitest'
import {
  MEMORY_EXTRACTION_LIMIT,
  MEMORY_INJECTION_LIMIT,
  MESSAGE_FEEDBACK_INJECTION_LIMIT,
  RECENT_MESSAGE_LIMIT,
} from '@/modules/companion/langchain/constants.js'

describe('companion injection limits (gap-matrix G-MEM / G-FB / G-CTX)', () => {
  it('UT-MEM-inject-limit: MEMORY_INJECTION_LIMIT === 12', () => {
    expect(MEMORY_INJECTION_LIMIT).toBe(12)
  })

  it('UT-MEM-extract-limit: MEMORY_EXTRACTION_LIMIT === 2', () => {
    expect(MEMORY_EXTRACTION_LIMIT).toBe(2)
  })

  it('UT-FB-limit: MESSAGE_FEEDBACK_INJECTION_LIMIT === 8', () => {
    expect(MESSAGE_FEEDBACK_INJECTION_LIMIT).toBe(8)
  })

  it('UT-CTX-recent-limit: RECENT_MESSAGE_LIMIT === 18', () => {
    expect(RECENT_MESSAGE_LIMIT).toBe(18)
  })
  // findRecent「最近 N 条」行为由 IT-CTX-recent-limit 验收，不在此做空壳断言
})
