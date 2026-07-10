import { describe, expect, it } from 'vitest'
import { GoferChatProvider } from '@/features/chat/providers/GoferChatProvider'

const KB = '11111111-1111-1111-1111-111111111111'
const DOC = '22222222-2222-2222-2222-222222222222'
const MSG = '33333333-3333-3333-3333-333333333333'
const CONV = '44444444-4444-4444-4444-444444444444'

describe('GoferChatProvider', () => {
  // AbstractChatProvider requires a "manual" request adapter
  const provider = new GoferChatProvider({
    request: { manual: true } as any,
  })

  it('accumulates sources then message deltas', () => {
    const afterSources = provider.transformMessage({
      originMessage: { content: '', role: 'assistant' },
      chunk: {
        data: JSON.stringify({
          event: 'sources',
          conversation_id: CONV,
          message_id: MSG,
          sources: [{ kb_id: KB, document_id: DOC, content: 'ctx' }],
          retrieval_empty: false,
        }),
      },
    } as any)

    expect(afterSources.sources).toHaveLength(1)
    expect(afterSources.sources?.[0].kb_id).toBe(KB)
    expect(afterSources.content).toBe('')

    const afterDelta = provider.transformMessage({
      originMessage: afterSources,
      chunk: {
        data: JSON.stringify({
          event: 'message',
          conversation_id: CONV,
          message_id: MSG,
          answer: 'hello',
        }),
      },
    } as any)

    expect(afterDelta.content).toBe('hello')
    expect(afterDelta.sources).toHaveLength(1)

    const afterEnd = provider.transformMessage({
      originMessage: afterDelta,
      chunk: {
        data: JSON.stringify({
          event: 'message_end',
          conversation_id: CONV,
          message_id: MSG,
          answer: 'hello world',
          retrieval_empty: false,
        }),
      },
    } as any)

    expect(afterEnd.content).toBe('hello world')
    expect(afterEnd.sources).toHaveLength(1)
  })

  it('marks retrieval_empty on sources event', () => {
    const msg = provider.transformMessage({
      originMessage: { content: '', role: 'assistant' },
      chunk: {
        data: JSON.stringify({
          event: 'sources',
          conversation_id: CONV,
          message_id: MSG,
          sources: [],
          retrieval_empty: true,
        }),
      },
    } as any)
    expect(msg.retrieval_empty).toBe(true)
    expect(msg.sources).toEqual([])
  })
})
