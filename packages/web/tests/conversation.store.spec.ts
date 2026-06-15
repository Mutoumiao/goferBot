import { describe, test, expect, beforeEach, vi } from 'vitest'
import type { Message } from '@goferbot/data'
import { useConversationStore } from '@/stores/conversation.store'

function makeMessage(overrides?: Partial<Message>): Message {
  return {
    id: `msg-${Date.now()}`,
    role: 'user',
    content: 'hello',
    sessionId: 'conv-1',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('ConversationStore', () => {
  beforeEach(() => {
    useConversationStore.getState().reset()
  })

  test('getOrCreateConversation 创建新会话', () => {
    const conversation = useConversationStore.getState().getOrCreateConversation('conv-1')

    expect(conversation.id).toBe('conv-1')
    expect(conversation.messages).toHaveLength(0)
    expect(conversation.streaming).toBe(false)
    expect(useConversationStore.getState().conversationMap['conv-1']).toBeDefined()
  })

  test('getOrCreateConversation 返回已存在会话', () => {
    const first = useConversationStore.getState().getOrCreateConversation('conv-1')
    const second = useConversationStore.getState().getOrCreateConversation('conv-1')

    expect(second).toBe(first)
  })

  test('setMessages 设置消息列表', () => {
    const messages = [
      makeMessage({ id: 'm1', role: 'user', content: 'hi' }),
      makeMessage({ id: 'm2', role: 'assistant', content: 'hello' }),
    ]

    useConversationStore.getState().setMessages('conv-1', messages)

    expect(useConversationStore.getState().conversationMap['conv-1'].messages).toHaveLength(2)
    expect(useConversationStore.getState().conversationMap['conv-1'].messages[0].id).toBe('m1')
  })

  test('appendMessage 追加消息', () => {
    useConversationStore.getState().setMessages('conv-1', [makeMessage({ id: 'm1' })])

    useConversationStore.getState().appendMessage('conv-1', makeMessage({ id: 'm2' }))

    expect(useConversationStore.getState().conversationMap['conv-1'].messages).toHaveLength(2)
    expect(useConversationStore.getState().conversationMap['conv-1'].messages[1].id).toBe('m2')
  })

  test('updateMessage 更新指定消息内容', () => {
    useConversationStore.getState().setMessages('conv-1', [
      makeMessage({ id: 'm1', content: 'old' }),
    ])

    useConversationStore.getState().updateMessage('conv-1', 'm1', { content: 'updated' })

    expect(useConversationStore.getState().conversationMap['conv-1'].messages[0].content).toBe('updated')
  })

  test('setStreaming 更新流式状态', () => {
    useConversationStore.getState().setStreaming('conv-1', true)

    expect(useConversationStore.getState().conversationMap['conv-1'].streaming).toBe(true)
  })

  test('setAbortController 设置并触发中止', () => {
    const controller = new AbortController()
    const abortSpy = vi.spyOn(controller, 'abort')

    useConversationStore.getState().setAbortController('conv-1', controller)

    expect(useConversationStore.getState().conversationMap['conv-1'].abortController).toBe(controller)

    useConversationStore.getState().abortConversation('conv-1')

    expect(abortSpy).toHaveBeenCalled()
    expect(useConversationStore.getState().conversationMap['conv-1'].abortController).toBeUndefined()
    expect(useConversationStore.getState().conversationMap['conv-1'].streaming).toBe(false)
  })

  test('clearConversation 清除指定会话', () => {
    useConversationStore.getState().setMessages('conv-1', [makeMessage()])
    useConversationStore.getState().setMessages('conv-2', [makeMessage()])

    useConversationStore.getState().clearConversation('conv-1')

    expect(useConversationStore.getState().conversationMap['conv-1']).toBeUndefined()
    expect(useConversationStore.getState().conversationMap['conv-2']).toBeDefined()
  })
})
