import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'
import type { LLMConfig } from '@/types'

export interface Session {
  id: string
  title: string
  provider: string | null
  model: string | null
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export const useSessionStore = defineStore('session', () => {
  // State
  const sessions = ref<Session[]>([])
  const activeSessionId = ref<string | null>(null)
  const messages = ref<Map<string, Message[]>>(new Map())
  const isLoading = ref(false)
  const isStreaming = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const activeSession = computed(() =>
    sessions.value.find((s) => s.id === activeSessionId.value) ?? null
  )

  const activeMessages = computed(() => {
    if (!activeSessionId.value) return []
    return messages.value.get(activeSessionId.value) ?? []
  })

  // Actions
  async function loadSessions() {
    isLoading.value = true
    error.value = null
    try {
      const data = await api.get<{ items: Session[] }>('/api/sessions')
      sessions.value = data.items ?? []
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载会话列表失败'
    } finally {
      isLoading.value = false
    }
  }

  async function createSession() {
    isLoading.value = true
    error.value = null
    try {
      const data = await api.post<Session>('/api/sessions')
      sessions.value.unshift(data)
      activeSessionId.value = data.id
      messages.value.set(data.id, [])
      return data
    } catch (e) {
      error.value = e instanceof Error ? e.message : '创建会话失败'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function loadSession(id: string) {
    isLoading.value = true
    error.value = null
    try {
      const data = await api.get<{ session: Session; messages: Message[] }>(`/api/sessions/${id}`)
      const session = data.session
      const msgs = data.messages ?? []

      const idx = sessions.value.findIndex((s) => s.id === id)
      if (idx !== -1) {
        sessions.value[idx] = session
      } else {
        sessions.value.unshift(session)
      }

      activeSessionId.value = id
      messages.value.set(id, msgs)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载会话失败'
    } finally {
      isLoading.value = false
    }
  }

  async function renameSession(id: string, title: string) {
    const trimmed = title.trim()
    if (!trimmed) return
    try {
      await api.patch(`/api/sessions/${id}`, { title: trimmed })
      const idx = sessions.value.findIndex((s) => s.id === id)
      if (idx !== -1) {
        sessions.value[idx].title = trimmed
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '重命名失败'
    }
  }

  async function deleteSession(id: string) {
    try {
      await api.delete(`/api/sessions/${id}`)
      sessions.value = sessions.value.filter((s) => s.id !== id)
      messages.value.delete(id)
      if (activeSessionId.value === id) {
        activeSessionId.value = null
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '删除会话失败'
    }
  }

  async function sendMessage(
    content: string,
    knowledgeBaseIds: string[] = [],
    options?: { llmConfig?: LLMConfig | null; onNewSession?: (sessionId: string, title: string) => void }
  ) {
    error.value = null
    isLoading.value = true

    try {
      let sessionId = activeSessionId.value
      let isNew = false

      if (!sessionId) {
        const session = await createSession()
        sessionId = session.id
        isNew = true
      }

      const userMsg: Message = {
        id: `msg-user-${crypto.randomUUID()}`,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      }

      const list = [...(messages.value.get(sessionId!) ?? []), userMsg]
      messages.value.set(sessionId!, list)

      if (isNew) {
        const idx = sessions.value.findIndex((s) => s.id === sessionId)
        const summary = content.slice(0, 20) + (content.length > 20 ? '...' : '')
        if (idx !== -1) {
          sessions.value[idx].title = summary
        }
        options?.onNewSession?.(sessionId!, summary)
      }

      const assistantMsg: Message = {
        id: `msg-assistant-${crypto.randomUUID()}`,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      }
      const listWithAssistant = [...list, assistantMsg]
      messages.value.set(sessionId!, listWithAssistant)

      isStreaming.value = true

      const llmConfig = options?.llmConfig
      if (!llmConfig) {
        error.value = '未配置 LLM 提供商，请前往设置页配置'
        isLoading.value = false
        return
      }

      api.sse(
        '/api/chat',
        {
          message: content,
          sessionId,
          knowledgeBaseIds,
          config: llmConfig,
        },
        {
          onChunk: (chunk: { chunk: string; done: boolean }) => {
            assistantMsg.content += chunk.chunk
            messages.value.set(sessionId!, [...listWithAssistant])
          },
          onError: (err) => {
            error.value = err.message
            isStreaming.value = false
            isLoading.value = false
          },
          onDone: () => {
            isStreaming.value = false
            isLoading.value = false
          },
        }
      )
    } catch (e) {
      error.value = e instanceof Error ? e.message : '发送消息失败'
      isLoading.value = false
    }
  }

  return {
    sessions,
    activeSessionId,
    messages,
    isLoading,
    isStreaming,
    error,
    activeSession,
    activeMessages,
    loadSessions,
    createSession,
    loadSession,
    renameSession,
    deleteSession,
    sendMessage,
  }
})
