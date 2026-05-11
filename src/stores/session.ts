import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { sidecarFetch } from '@/utils/sidecarClient'
import { useSettingsStore } from './settings'
import type { Message, Tab, LLMConfig } from '@/types'

export const useSessionStore = defineStore('session', () => {
  // Tabs
  const tabs = ref<Tab[]>([
    { id: 'home', type: 'chat', title: '首页', closable: true },
  ])
  const activeTabId = ref<string>('home')

  // Messages keyed by sessionId
  const messages = ref<Map<string, Message[]>>(new Map())
  const isSending = ref(false)
  const sendError = ref<string | null>(null)

  const historySessions = ref<
    Array<{
      id: string
      title: string
      updated_at: number
      summary: string
      message_count: number
    }>
  >([])

  const activeTab = computed(() => tabs.value.find((t) => t.id === activeTabId.value))
  const activeMessages = computed(() => {
    const sessionId = activeTab.value?.sessionId
    return sessionId ? (messages.value.get(sessionId) ?? []) : []
  })

  function addTab(tab: Tab) {
    tabs.value.push(tab)
    activeTabId.value = tab.id
  }

  function closeTab(tabId: string) {
    const idx = tabs.value.findIndex((t) => t.id === tabId)
    if (idx === -1) return

    const tab = tabs.value[idx]
    // 只剩一个空首页时不可删除
    if (tabs.value.length === 1 && tab.type === 'chat' && !tab.sessionId) return

    tabs.value.splice(idx, 1)
    if (activeTabId.value === tabId) {
      activeTabId.value = tabs.value[Math.min(idx, tabs.value.length - 1)]?.id ?? ''
    }

    // 删光后自动新建首页
    if (tabs.value.length === 0) {
      const settingsStore = useSettingsStore()
      const defaultCfg = settingsStore.getLLMConfig()
      const newHomeId = `home-${Date.now()}`
      tabs.value.push({
        id: newHomeId,
        type: 'chat',
        title: '首页',
        closable: true,
        provider: defaultCfg?.provider,
        model: defaultCfg?.model,
      })
      activeTabId.value = newHomeId
    }
  }

  function switchTab(tabId: string) {
    activeTabId.value = tabId
  }

  async function loadSession(sessionId: string) {
    const res = await sidecarFetch(`/sessions/${sessionId}`)
    const data = (await res.json()) as { messages: Message[] }
    messages.value.set(sessionId, data.messages ?? [])
  }

  async function loadHistory() {
    const res = await sidecarFetch('/sessions')
    if (res.ok) {
      historySessions.value = await res.json()
    }
  }

  async function restoreSession(sessionId: string) {
    const existingTab = tabs.value.find((t) => t.sessionId === sessionId)
    if (existingTab) {
      activeTabId.value = existingTab.id
      return
    }

    const res = await sidecarFetch(`/sessions/${sessionId}`)
    if (!res.ok) return
    const data = (await res.json()) as {
      id: string
      title: string
      provider: string | null
      model: string | null
      messages: Message[]
    }

    messages.value.set(sessionId, data.messages ?? [])

    const homeTab = tabs.value.find((t) => t.type === 'chat' && !t.sessionId)
    if (homeTab) {
      homeTab.sessionId = sessionId
      homeTab.title = data.title
      activeTabId.value = homeTab.id
    } else {
      addTab({
        id: `chat-${Date.now()}`,
        type: 'chat',
        title: data.title,
        sessionId,
        closable: true,
      })
    }
  }

  async function deleteSession(sessionId: string) {
    const tab = tabs.value.find((t) => t.sessionId === sessionId)
    if (tab) {
      closeTab(tab.id)
    }
    messages.value.delete(sessionId)
    await sidecarFetch(`/sessions/${sessionId}`, { method: 'DELETE' })
    await loadHistory()
  }

  async function renameSession(sessionId: string, newTitle: string) {
    const trimmed = newTitle.trim()
    if (!trimmed) return

    await sidecarFetch(`/sessions/${sessionId}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    })

    const tab = tabs.value.find((t) => t.sessionId === sessionId)
    if (tab) {
      tab.title = trimmed
    }

    const entry = historySessions.value.find((h) => h.id === sessionId)
    if (entry) {
      entry.title = trimmed
    }
  }

  async function sendMessage(content: string, config: LLMConfig, knowledgeBaseIds?: string[]) {
    sendError.value = null
    isSending.value = true

    try {
      let sessionId = activeTab.value?.sessionId
      const isNewSession = !sessionId

      if (!sessionId) {
        sessionId = crypto.randomUUID()
      }

      // Optimistically add user message
      const userMsg: Message = {
        id: `temp-user-${Date.now()}`,
        session_id: sessionId,
        role: 'user',
        content,
        knowledge_base_ids: knowledgeBaseIds ? JSON.stringify(knowledgeBaseIds) : null,
        created_at: Date.now(),
      }

      if (isNewSession) {
        messages.value.set(sessionId, [userMsg])
      } else {
        const list = messages.value.get(sessionId) ?? []
        list.push(userMsg)
        messages.value.set(sessionId, list)
      }

      const response = await sidecarFetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, sessionId, knowledgeBaseIds, config }),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '请求失败')
        throw new Error(errText)
      }

      // Promote home tab after first successful request
      if (isNewSession) {
        const activeIdx = tabs.value.findIndex((t) => t.id === activeTabId.value)
        if (activeIdx !== -1) {
          tabs.value[activeIdx].sessionId = sessionId
          tabs.value[activeIdx].title = content.slice(0, 20) + (content.length > 20 ? '...' : '')
          tabs.value[activeIdx].provider = config.provider
          tabs.value[activeIdx].model = config.model
        }

        const settingsStore = useSettingsStore()
        const defaultCfg = settingsStore.getLLMConfig()
        const newHomeId = `home-${Date.now()}`
        tabs.value.push({
          id: newHomeId,
          type: 'chat',
          title: '首页',
          closable: true,
          provider: defaultCfg?.provider,
          model: defaultCfg?.model,
        })
      }

      // Read SSE stream
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      let assistantContent = ''
      const assistantId = `temp-assistant-${Date.now()}`

      const currentList = messages.value.get(sessionId) ?? []
      currentList.push({
        id: assistantId,
        session_id: sessionId,
        role: 'assistant',
        content: '',
        created_at: Date.now(),
      })
      messages.value.set(sessionId, currentList)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            if (parsed.content) {
              assistantContent += parsed.content
              const list = messages.value.get(sessionId) ?? []
              const last = list[list.length - 1]
              if (last && last.role === 'assistant' && last.id === assistantId) {
                last.content = assistantContent
              }
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (e) {
      sendError.value = e instanceof Error ? e.message : String(e)
    } finally {
      isSending.value = false
    }
  }

  return {
    tabs,
    activeTabId,
    messages,
    isSending,
    sendError,
    historySessions,
    activeTab,
    activeMessages,
    addTab,
    closeTab,
    switchTab,
    loadSession,
    sendMessage,
    loadHistory,
    restoreSession,
    deleteSession,
    renameSession,
  }
})
