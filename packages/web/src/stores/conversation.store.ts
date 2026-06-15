import { create } from 'zustand'
import type { Message } from '@goferbot/data'

export interface Conversation {
  id: string
  messages: Message[]
  streaming: boolean
  abortController?: AbortController
}

interface ConversationState {
  conversationMap: Record<string, Conversation>
}

interface ConversationActions {
  getOrCreateConversation: (id: string) => Conversation
  setMessages: (id: string, messages: Message[]) => void
  appendMessage: (id: string, message: Message) => void
  updateMessage: (id: string, messageId: string, updates: Partial<Message>) => void
  setStreaming: (id: string, streaming: boolean) => void
  setAbortController: (id: string, controller: AbortController | undefined) => void
  abortConversation: (id: string) => void
  clearConversation: (id: string) => void
  reset: () => void
}

export type ConversationStore = ConversationState & ConversationActions

function createEmptyConversation(id: string): Conversation {
  return {
    id,
    messages: [],
    streaming: false,
  }
}

export const useConversationStore = create<ConversationStore>()((set, get) => ({
  conversationMap: {},

  getOrCreateConversation: (id) => {
    const existing = get().conversationMap[id]
    if (existing) return existing

    const conversation = createEmptyConversation(id)
    set((state) => ({
      conversationMap: { ...state.conversationMap, [id]: conversation },
    }))
    return conversation
  },

  setMessages: (id, messages) => {
    set((state) => {
      const existing = state.conversationMap[id]
      const conversation: Conversation = existing
        ? { ...existing, messages }
        : { ...createEmptyConversation(id), messages }
      return {
        conversationMap: { ...state.conversationMap, [id]: conversation },
      }
    })
  },

  appendMessage: (id, message) => {
    set((state) => {
      const existing = state.conversationMap[id]
      const conversation: Conversation = existing
        ? { ...existing, messages: [...existing.messages, message] }
        : { ...createEmptyConversation(id), messages: [message] }
      return {
        conversationMap: { ...state.conversationMap, [id]: conversation },
      }
    })
  },

  updateMessage: (id, messageId, updates) => {
    set((state) => {
      const existing = state.conversationMap[id]
      if (!existing) return state

      const messages = existing.messages.map((m) =>
        m.id === messageId ? { ...m, ...updates } : m,
      )
      return {
        conversationMap: {
          ...state.conversationMap,
          [id]: { ...existing, messages },
        },
      }
    })
  },

  setStreaming: (id, streaming) => {
    set((state) => {
      const existing = state.conversationMap[id]
      const conversation: Conversation = existing
        ? { ...existing, streaming }
        : { ...createEmptyConversation(id), streaming }
      return {
        conversationMap: { ...state.conversationMap, [id]: conversation },
      }
    })
  },

  setAbortController: (id, controller) => {
    set((state) => {
      const existing = state.conversationMap[id]
      const conversation: Conversation = existing
        ? { ...existing, abortController: controller }
        : { ...createEmptyConversation(id), abortController: controller }
      return {
        conversationMap: { ...state.conversationMap, [id]: conversation },
      }
    })
  },

  abortConversation: (id) => {
    const conversation = get().conversationMap[id]
    if (conversation?.abortController) {
      conversation.abortController.abort()
      get().setAbortController(id, undefined)
      get().setStreaming(id, false)
    }
  },

  clearConversation: (id) => {
    set((state) => {
      const map = { ...state.conversationMap }
      delete map[id]
      return { conversationMap: map }
    })
  },

  reset: () => {
    set({ conversationMap: {} })
  },
}))

declare global {
  interface Window {
    __conversation?: typeof useConversationStore
  }
}

if (typeof window !== 'undefined') {
  window.__conversation = useConversationStore
}
