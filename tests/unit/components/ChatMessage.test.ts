import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatMessage from '@/components/ChatMessage.vue'

describe('ChatMessage', () => {
  it('renders user message with right alignment and white background', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: '1',
          session_id: 's1',
          role: 'user',
          content: 'hello',
          created_at: 1,
        },
      },
    })
    expect(wrapper.classes()).toContain('justify-end')
    expect(wrapper.find('.bg-accent-600').exists()).toBe(true)
    expect(wrapper.text()).toContain('hello')
  })

  it('renders assistant message with left alignment and border', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: '2',
          session_id: 's1',
          role: 'assistant',
          content: 'reply',
          created_at: 2,
        },
      },
    })
    expect(wrapper.classes()).toContain('justify-start')
    expect(wrapper.find('.border-border-subtle').exists()).toBe(true)
  })

  it('shows user avatar for user messages', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: '1',
          session_id: 's1',
          role: 'user',
          content: 'hi',
          created_at: 1,
        },
      },
    })
    expect(wrapper.find('.i-mdi-account').exists()).toBe(true)
    expect(wrapper.find('.i-mdi-robot').exists()).toBe(false)
  })

  it('shows AI avatar and accent line for assistant messages', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: '2',
          session_id: 's1',
          role: 'assistant',
          content: 'hello',
          created_at: 2,
        },
      },
    })
    expect(wrapper.find('.i-mdi-robot').exists()).toBe(true)
    expect(wrapper.find('[class*="bg-accent-500/40"]').exists()).toBe(true)
  })

  it('renders markdown for assistant content', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: '2',
          session_id: 's1',
          role: 'assistant',
          content: '**bold**',
          created_at: 2,
        },
      },
    })
    expect(wrapper.findComponent({ name: 'MarkdownRender' }).exists()).toBe(true)
  })

  it('renders plain text for user content', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: '1',
          session_id: 's1',
          role: 'user',
          content: 'plain text',
          created_at: 1,
        },
      },
    })
    expect(wrapper.find('.whitespace-pre-wrap').text()).toBe('plain text')
  })
})
