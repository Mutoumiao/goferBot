import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getBackend } from '@/backend'
import { useSettingsStore } from './settings'
import type { Message, Tab, LLMConfig, ChatErrorType } from '@/types'

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
  const sendErrorType = ref<ChatErrorType | null>(null)

  const historySessions = ref<
    Array<{
      id: string
      title: string
      updated_at: number
      summary: string
      message_count: number
    }>
  >([])
  const historyError = ref<string | null>(null)
  const historyLoading = ref(false)

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
    const backend = getBackend()
    const res = await backend.request('GET', `/sessions/${sessionId}`)
    const data = (await res.json()) as { messages: Message[] }
    messages.value.set(sessionId, data.messages ?? [])
  }

  async function loadHistory() {
    historyLoading.value = true
    historyError.value = null
    try {
      const backend = getBackend()
      const res = await backend.request('GET', '/sessions')
      if (res.ok) {
        historySessions.value = await res.json()
      } else {
        historyError.value = '加载历史记录失败'
      }
    } catch {
      historyError.value = '加载历史记录失败'
    } finally {
      historyLoading.value = false
    }
  }

  async function restoreSession(sessionId: string) {
    const existingTab = tabs.value.find((t) => t.sessionId === sessionId)
    if (existingTab) {
      activeTabId.value = existingTab.id
      return
    }

    const backend = getBackend()
    const res = await backend.request('GET', `/sessions/${sessionId}`)
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
      homeTab.provider = data.provider ?? undefined
      homeTab.model = data.model ?? undefined
      activeTabId.value = homeTab.id
    } else {
      addTab({
        id: `chat-${Date.now()}`,
        type: 'chat',
        title: data.title,
        sessionId,
        closable: true,
        provider: data.provider ?? undefined,
        model: data.model ?? undefined,
      })
    }
  }

  async function deleteSession(sessionId: string) {
    const tab = tabs.value.find((t) => t.sessionId === sessionId)
    if (tab) {
      closeTab(tab.id)
    }
    messages.value.delete(sessionId)
    const backend = getBackend()
    await backend.request('DELETE', `/sessions/${sessionId}`)
    await loadHistory()
  }

  async function renameSession(sessionId: string, newTitle: string) {
    const trimmed = newTitle.trim()
    if (!trimmed) return

    const backend = getBackend()
    await backend.request('POST', `/sessions/${sessionId}/rename`, { title: trimmed })

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
    sendErrorType.value = null
    isSending.value = true

    // Pre-check: sidecar ready
    const backend = getBackend()
    const ready = await backend.isReady()
    if (!ready) {
      sendError.value = 'Sidecar 服务未就绪，请检查服务状态'
      sendErrorType.value = 'sidecar_error'
      isSending.value = false
      return
    }

    // Pre-check: valid LLM config
    if (!config.provider || !config.model) {
      sendError.value = '未配置 LLM 模型，请前往设置页配置'
      sendErrorType.value = 'unknown'
      isSending.value = false
      return
    }

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

      const { completed } = backend.subscribe('/chat', {
        message: content,
        sessionId,
        knowledgeBaseIds,
        config,
      }, (data, eventType) => {
        if (eventType === 'error') {
          try {
            const parsed = JSON.parse(data)
            sendErrorType.value = parsed.type || 'unknown'
            sendError.value = parsed.message || '请求失败'
            const list = messages.value.get(sessionId!) ?? []
            list.push({
              id: `temp-error-${Date.now()}`,
              session_id: sessionId!,
              role: 'error',
              content: parsed.message || '请求失败',
              errorType: parsed.type || 'unknown',
              created_at: Date.now(),
            })
            messages.value.set(sessionId!, list)
          } catch {
            // ignore parse error
          }
          return
        }

        try {
          const parsed = JSON.parse(data)
          if (parsed.content) {
            assistantContent += parsed.content
            const list = messages.value.get(sessionId!) ?? []
            const lastMsg = list[list.length - 1]
            if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id === assistantId) {
              lastMsg.content = assistantContent
            }
          }
        } catch {
          // ignore parse error
        }
      })

      await completed
    } catch (e) {
      sendError.value = e instanceof Error ? e.message : String(e)
      if (!sendErrorType.value) {
        sendErrorType.value = 'network_error'
      }
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
    sendErrorType,
    historySessions,
    historyError,
    historyLoading,
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
