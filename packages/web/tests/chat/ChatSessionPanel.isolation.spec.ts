/**
 * A6/A7 关键场景：会话切换 isolation — streamGeneration + stop 语义
 * 通过纯逻辑验证 generation 守卫（与 ChatSessionPanel 同构），避免挂载完整 useChat。
 */
import { describe, expect, it } from 'vitest'
import {
  getMessageSources,
  historyMessageToUiMessage,
  textFromUiMessage,
} from '../../src/features/chat/message-sources'

describe('ChatSession isolation helpers (A6/A7)', () => {
  it('A7: generation bump invalidates prior async write', () => {
    let generation = 0
    const writes: string[] = []

    const startLoad = (sessionId: string) => {
      const g = ++generation
      return {
        apply: (content: string) => {
          if (g !== generation) return false
          writes.push(`${sessionId}:${content}`)
          return true
        },
      }
    }

    const a = startLoad('A')
    const b = startLoad('B')
    // A 的晚到响应不得写入
    expect(a.apply('stale-from-A')).toBe(false)
    expect(b.apply('fresh-B')).toBe(true)
    expect(writes).toEqual(['B:fresh-B'])
  })

  it('A6: history hydrate keeps partial assistant text (abort 保留已生成正文的数据侧)', () => {
    const ui = historyMessageToUiMessage({
      id: 'm1',
      role: 'assistant',
      content: '已生成的部分回答',
      metadata: {
        sources: [{ kb_id: 'k1', document_id: 'd1' }],
        retrieval_empty: false,
      },
    })
    expect(textFromUiMessage(ui)).toBe('已生成的部分回答')
    expect(getMessageSources(ui)?.[0].document_id).toBe('d1')
  })

  it('I2: session-scoped history messages map independently', () => {
    const sessionA = historyMessageToUiMessage({
      id: 'a1',
      role: 'user',
      content: '问题 A',
    })
    const sessionB = historyMessageToUiMessage({
      id: 'b1',
      role: 'user',
      content: '问题 B',
    })
    expect(textFromUiMessage(sessionA)).toBe('问题 A')
    expect(textFromUiMessage(sessionB)).toBe('问题 B')
    expect(sessionA.id).not.toBe(sessionB.id)
  })
})
