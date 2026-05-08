import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { sidecarFetch } from '@/utils/sidecarClient'
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
      const newHomeId = `home-${Date.now()}`
      tabs.value.push({ id: newHomeId, type: 'chat', title: '首页', closable: true })
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

  async function sendMessage(content: string, config: LLMConfig) {
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
        body: JSON.stringify({ message: content, sessionId, config }),
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
        }

        const newHomeId = `home-${Date.now()}`
        tabs.value.push({
          id: newHomeId,
          type: 'chat',
          title: '首页',
          closable: true,
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
    activeTab,
    activeMessages,
    addTab,
    closeTab,
    switchTab,
    loadSession,
    sendMessage,
  }
})
