/**
 * UT-REL-msg-count: relationship 注入 messageCount 不得用 recent 窗口长度
 */
import { describe, expect, it } from 'vitest'
import { resolveRelationshipMessageCount } from '@/modules/companion/langgraph/nodes/relationship-stage-node.js'

describe('relationship messageCount (G-REL / UT-REL-msg-count)', () => {
  it('UT-REL-msg-count: prefers conversation messageCount over recent window length', () => {
    const recent = Array.from({ length: 18 }, (_, i) => ({
      id: `m${i}`,
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `c${i}`,
      createdAt: new Date(),
    }))
    expect(resolveRelationshipMessageCount({ messageCount: 40, recentMessages: recent })).toBe(40)
    expect(resolveRelationshipMessageCount({ messageCount: 1, recentMessages: recent })).toBe(1)
  })

  it('UT-REL-msg-count-fallback: without messageCount falls back to recent length', () => {
    expect(
      resolveRelationshipMessageCount({
        recentMessages: [
          { id: 'a', role: 'user', content: 'x', createdAt: new Date() },
          { id: 'b', role: 'assistant', content: 'y', createdAt: new Date() },
        ],
      }),
    ).toBe(2)
    expect(resolveRelationshipMessageCount({})).toBe(0)
  })

  it('UT-REL-msg-count-sanitize: floors and clamps non-finite', () => {
    expect(resolveRelationshipMessageCount({ messageCount: 3.9 })).toBe(3)
    expect(resolveRelationshipMessageCount({ messageCount: -2 })).toBe(0)
    expect(resolveRelationshipMessageCount({ messageCount: Number.NaN, recentMessages: [] })).toBe(
      0,
    )
  })
})
