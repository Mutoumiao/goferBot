import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'
import ChatPage from '@/components/ChatPage.vue'
import EmptySession from '@/components/EmptySession.vue'
import ChatInput from '@/components/ChatInput.vue'
import ChatMessageList from '@/components/ChatMessageList.vue'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'

describe('ChatPage', () => {
  function mountPage(overrides?: { session?: Partial<ReturnType<typeof useSessionStore>> }) {
    const pinia = createTestingPinia({
      stubActions: false,
      initialState: {
        session: {
          tabs: [{ id: 'home', type: 'chat' as const, title: '首页', closable: false }],
          activeTabId: 'home',
          messages: new Map(),
          isSending: false,
          sendError: null,
          ...overrides?.session,
        },
        settings: {
          config: {
            providers: {
              openai: { apiKey: '', model: '', baseUrl: '' },
              claude: { apiKey: '', model: '', baseUrl: '' },
              deepseek: { apiKey: 'key', model: 'test', baseUrl: '' },
              custom: { apiKey: '', model: '', baseUrl: '' },
              ollama: { enabled: false, url: '', model: '' },
            },
            embeddingProvider: { provider: 'openai', apiKey: '', model: '', baseUrl: '' },
            temperature: 0.7,
            defaultChatProvider: 'deepseek',
          },
        },
      },
    })
    setActivePinia(pinia)

    return mount(ChatPage, {
      global: {
        plugins: [pinia],
        stubs: {
          ChatMessage: true,
        },
      },
    })
  }

  it('shows EmptySession when home tab has no messages', () => {
    const wrapper = mountPage()
    expect(wrapper.findComponent(EmptySession).exists()).toBe(true)
    expect(wrapper.findComponent(ChatMessageList).exists()).toBe(false)
    expect(wrapper.findComponent(ChatInput).exists()).toBe(false)
  })

  it('shows ChatMessageList and ChatInput when there are messages', async () => {
    const wrapper = mountPage()
    const sessionStore = useSessionStore()

    sessionStore.tabs[0].sessionId = 'sess-1'
    sessionStore.messages.set('sess-1', [
      { id: 'm1', session_id: 'sess-1', role: 'user' as const, content: 'hello', created_at: 1 },
    ])

    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent(EmptySession).exists()).toBe(false)
    expect(wrapper.findComponent(ChatMessageList).exists()).toBe(true)
    expect(wrapper.findComponent(ChatInput).exists()).toBe(true)
  })

  it('passes activeMessages to ChatMessageList', async () => {
    const wrapper = mountPage()
    const sessionStore = useSessionStore()
    const msg = { id: 'm1', session_id: 'sess-1', role: 'user' as const, content: 'hello', created_at: 1 }

    sessionStore.tabs[0].sessionId = 'sess-1'
    sessionStore.messages.set('sess-1', [msg])

    await wrapper.vm.$nextTick()

    const list = wrapper.findComponent(ChatMessageList)
    expect(list.props('messages')).toEqual([msg])
  })

  it('passes loading prop to ChatInput based on isSending', async () => {
    const wrapper = mountPage()
    const sessionStore = useSessionStore()

    sessionStore.tabs[0].sessionId = 'sess-1'
    sessionStore.messages.set('sess-1', [
      { id: 'm1', session_id: 'sess-1', role: 'user' as const, content: 'hello', created_at: 1 },
    ])
    sessionStore.isSending = true

    await wrapper.vm.$nextTick()

    const input = wrapper.findComponent(ChatInput)
    expect(input.props('loading')).toBe(true)
  })

  it('displays error when sendError is set', async () => {
    const wrapper = mountPage()
    const sessionStore = useSessionStore()
    sessionStore.sendError = 'Something went wrong'

    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Something went wrong')
  })

  it('calls store.sendMessage when ChatInput emits send', async () => {
    const wrapper = mountPage()
    const sessionStore = useSessionStore()
    const settingsStore = useSettingsStore()

    sessionStore.tabs[0].sessionId = 'sess-1'
    sessionStore.messages.set('sess-1', [
      { id: 'm1', session_id: 'sess-1', role: 'user' as const, content: 'hello', created_at: 1 },
    ])

    await wrapper.vm.$nextTick()

    const input = wrapper.findComponent(ChatInput)
    input.vm.$emit('send', 'new message')

    expect(sessionStore.sendMessage).toHaveBeenCalledWith('new message', settingsStore.getLLMConfig())
  })

  it('calls store.sendMessage when EmptySession emits send', () => {
    const wrapper = mountPage()
    const sessionStore = useSessionStore()
    const settingsStore = useSettingsStore()

    const empty = wrapper.findComponent(EmptySession)
    empty.vm.$emit('send', 'first message')

    expect(sessionStore.sendMessage).toHaveBeenCalledWith('first message', settingsStore.getLLMConfig())
  })
})
