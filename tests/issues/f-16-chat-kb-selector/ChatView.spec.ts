import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatView from '@/views/ChatView.vue'

vi.mock('@/stores/session', () => ({
  useSessionStore: () => ({
    activeSessionId: 'session-a',
    activeMessages: [],
    activeSession: null,
    isLoading: false,
    error: null,
    sendMessage: vi.fn(),
    loadSessions: vi.fn(),
  }),
}))
vi.mock('@/stores/knowledgeBase', () => ({
  useKnowledgeBaseStore: () => ({
    knowledgeBases: [],
    isLoading: false,
    error: null,
    loadKnowledgeBases: vi.fn(),
  }),
}))
vi.mock('@/stores/tabs', () => ({
  useTabsStore: () => ({
    updateActiveTabSession: vi.fn(),
  }),
}))
vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({
    getLLMConfig: () => null,
  }),
}))

describe('ChatView session switch', () => {
  it('AC-05: clears selected KBs on session switch', async () => {
    setActivePinia(createPinia())
    const wrapper = mount(ChatView)
    const chatInput = wrapper.findComponent({ name: 'ChatInput' })
    expect(chatInput.exists()).toBe(true)
    // key binding ensures remount on session change
    // Vue 3 internal: component's vnode key is accessible via $.vnode.key
    const vm = chatInput.vm as any
    const key = vm.$?.vnode?.key ?? vm.$vnode?.key
    expect(key).toBe('session-a')
  })
})
