import { describe, it, expect } from 'vitest'
import { GoferChatProvider } from '@/features/chat/providers/GoferChatProvider'

describe('GoferChatProvider', () => {
  const provider = new GoferChatProvider({
    request: () => ({ manual: true, options: {} } as any),
  })

  describe('transformParams', () => {
    it('fills required fields with defaults', () => {
      const result = provider.transformParams({ query: 'hello' }, {} as any)

      expect(result.response_mode).toBe('streaming')
      expect(result.query).toBe('hello')
      expect(result.conversation_id).toBe('')
    })

    it('passes through optional fields', () => {
      const result = provider.transformParams(
        {
          query: 'hello',
          conversation_id: 's1',
          provider_key: 'deepseek',
          parent_message_id: 'm1',
          inputs: { key: 'value' },
          files: ['f1'],
          knowledge_base_ids: ['kb1', 'kb2'],
        },
        {} as any,
      )

      expect(result.query).toBe('hello')
      expect(result.conversation_id).toBe('s1')
      expect(result.provider_key).toBe('deepseek')
      expect(result.parent_message_id).toBe('m1')
      expect(result.inputs).toEqual({ key: 'value' })
      expect(result.files).toEqual(['f1'])
      expect(result.knowledge_base_ids).toEqual(['kb1', 'kb2'])
    })

    it('omits undefined optional fields', () => {
      const result = provider.transformParams({ query: 'hello' }, {} as any)

      expect(result.knowledge_base_ids).toBeUndefined()
      expect(result.provider_key).toBeUndefined()
    })
  })

  describe('transformLocalMessage', () => {
    it('returns user message from query', () => {
      const result = provider.transformLocalMessage({ query: 'hello' })

      expect(result).toEqual({ content: 'hello', role: 'user' })
    })
  })

  describe('transformMessage', () => {
    it('appends answer chunk to origin message', () => {
      const result = provider.transformMessage({
        originMessage: { content: 'prev', role: 'assistant' },
        chunk: { data: JSON.stringify({ answer: ' world' }) },
      } as any)

      expect(result).toEqual({ content: 'prev world', role: 'assistant' })
    })

    it('returns error content on error event', () => {
      const result = provider.transformMessage({
        originMessage: { content: '', role: 'assistant' },
        chunk: { data: JSON.stringify({ error: 'something wrong' }) },
      } as any)

      expect(result).toEqual({ content: 'something wrong', role: 'assistant' })
    })

    it('returns origin content when done', () => {
      const result = provider.transformMessage({
        originMessage: { content: 'final', role: 'assistant' },
        chunk: { data: JSON.stringify({ done: true }) },
      } as any)

      expect(result).toEqual({ content: 'final', role: 'assistant' })
    })

    it('ignores invalid JSON chunk data', () => {
      const result = provider.transformMessage({
        originMessage: { content: 'prev', role: 'assistant' },
        chunk: { data: 'not json' },
      } as any)

      expect(result).toEqual({ content: 'prev', role: 'assistant' })
    })
  })
})
