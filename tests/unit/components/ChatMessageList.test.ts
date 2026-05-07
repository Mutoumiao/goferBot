import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ChatMessageList from '@/components/ChatMessageList.vue'

describe('ChatMessageList', () => {
  it('renders empty when no messages', () => {
    const wrapper = mount(ChatMessageList, {
      props: { messages: [] },
    })
    expect(wrapper.findAllComponents({ name: 'ChatMessage' })).toHaveLength(0)
  })

  it('renders a ChatMessage for each message', () => {
    const messages = [
      { id: '1', session_id: 's1', role: 'user' as const, content: 'hi', created_at: 1 },
      { id: '2', session_id: 's1', role: 'assistant' as const, content: 'hello', created_at: 2 },
    ]
    const wrapper = mount(ChatMessageList, {
      props: { messages },
    })
    const items = wrapper.findAllComponents({ name: 'ChatMessage' })
    expect(items).toHaveLength(2)
    expect(items[0].props('message').id).toBe('1')
    expect(items[1].props('message').id).toBe('2')
  })

  it('scrolls to bottom when messages update', async () => {
    const wrapper = mount(ChatMessageList, {
      props: { messages: [] },
    })
    const container = wrapper.find({ ref: 'containerRef' }).element as HTMLDivElement
    const scrollToSpy = vi.spyOn(container, 'scrollTo').mockImplementation(() => {})
    Object.defineProperty(container, 'scrollHeight', { value: 500, configurable: true })

    await wrapper.setProps({
      messages: [
        { id: '1', session_id: 's1', role: 'user' as const, content: 'new', created_at: 1 },
      ],
    })
    await nextTick()

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 500, behavior: 'smooth' })
    scrollToSpy.mockRestore()
  })

  it('does not scroll when message count stays the same', async () => {
    const messages = [
      { id: '1', session_id: 's1', role: 'user' as const, content: 'a', created_at: 1 },
    ]
    const wrapper = mount(ChatMessageList, {
      props: { messages },
    })
    const container = wrapper.find({ ref: 'containerRef' }).element as HTMLDivElement
    const scrollToSpy = vi.spyOn(container, 'scrollTo').mockImplementation(() => {})

    // Update props with same length but different content
    await wrapper.setProps({
      messages: [
        { id: '1', session_id: 's1', role: 'user' as const, content: 'b', created_at: 1 },
      ],
    })
    await nextTick()

    // watch trigger on length, not deep content, so scrollTo should NOT be called again
    // Actually, setProps replaces the array with same length, watch sees length unchanged
    expect(scrollToSpy).not.toHaveBeenCalled()
    scrollToSpy.mockRestore()
  })
})
