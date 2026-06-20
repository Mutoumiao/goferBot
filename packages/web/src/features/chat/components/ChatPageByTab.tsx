import { XProvider } from '@ant-design/x'
import { useXChat } from '@ant-design/x-sdk'
import type { Message } from '@goferbot/data'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useConversationStore } from '@/stores/conversation.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { getPendingMessageKey } from '../constants'
import type { GoferInput, GoferMessage } from '../providers/GoferChatProvider'
import type { PendingMessage } from '../services'
import { createGoferProvider, fetchProviders, loadChatHistory } from '../services'
import { useChatStore } from '../store'
import { ChatSessionView } from './ChatSessionView'
import { ChatTempHome } from './ChatTempHome'

interface ChatPageByTabProps {
  tabId: string
}

function messagesToMessageInfos(messages: Message[]) {
  return messages.map((message) => ({
    id: message.id,
    message: {
      content: message.content,
      role: message.role as GoferMessage['role'],
    },
    status: 'success' as const,
  }))
}

function xMessagesToMessages(
  xMessages: { id: number | string; message: GoferMessage }[],
  conversationId: string,
): Message[] {
  return xMessages.map((xMsg, index) => ({
    id: typeof xMsg.id === 'string' ? xMsg.id : `msg-${index}`,
    sessionId: conversationId,
    role: xMsg.message.role,
    content: xMsg.message.content,
    createdAt: new Date().toISOString(),
  }))
}

export function ChatPageByTab({ tabId }: ChatPageByTabProps) {
  const tab = useWorkspaceStore((s) => s.tabs.find((t) => t.id === tabId))
  const pendingSentRef = useRef(false)
  // 记录上一次有效的 conversationId，用于区分「新建会话（undefined → id）」和「切换会话（id → id）」
  const prevConversationIdRef = useRef<string | undefined>(undefined)

  const providerRef = useState(() => createGoferProvider())[0]

  const conversationId = tab?.conversationId

  const { selectedProviderKey, setSelectedProviderKey } = useChatStore()
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null)

  const {
    messages: xMessages,
    onRequest,
    isRequesting,
    abort,
    setMessages,
  } = useXChat<GoferMessage, GoferMessage, GoferInput>({
    provider: providerRef,
    requestPlaceholder: () => ({
      content: '正在思考中...',
      role: 'assistant',
    }),
    requestFallback: (_, { error: err, messageInfo }) => {
      if (err.name === 'AbortError') {
        return {
          content: messageInfo?.message?.content || '已取消回复',
          role: 'assistant',
        }
      }
      return {
        content: '网络异常，请稍后重试',
        role: 'assistant',
      }
    },
  })

  // 初始化 providers
  useEffect(() => {
    fetchProviders()
  }, [])

  // 当 conversationId 变化时重置 pending 发送标记，避免切换会话后漏发
  useEffect(() => {
    pendingSentRef.current = false
  }, [])

  // 当 tab 绑定 conversationId 时加载历史消息。
  // - 新建会话（存在 pending message）：不清空，让 pending 自动发送的用户消息自然显示。
  // - 切换/初始加载已有会话（无 pending）：先清空旧消息，避免加载新历史期间显示旧内容。
  useEffect(() => {
    if (!conversationId) {
      prevConversationIdRef.current = conversationId
      return
    }

    const conversationStore = useConversationStore.getState()
    const cached = conversationStore.conversationMap[conversationId]

    if (cached?.messages.length) {
      setMessages(messagesToMessageInfos(cached.messages))
      prevConversationIdRef.current = conversationId
      return
    }

    // 没有 pending 时（切换会话或刷新后直接加载），先清空旧消息
    const pendingKey = getPendingMessageKey(conversationId)
    const hasPending = !!sessionStorage.getItem(pendingKey)
    if (!hasPending) {
      setMessages([])
    }

    let stale = false
    loadChatHistory(conversationId).then(() => {
      if (stale) return
      const fresh = useConversationStore.getState().conversationMap[conversationId]?.messages ?? []
      if (fresh.length) setMessages(messagesToMessageInfos(fresh))
    })

    prevConversationIdRef.current = conversationId
    return () => {
      stale = true
    }
  }, [conversationId, setMessages])

  // 同步 useXChat 消息到 conversation store
  useEffect(() => {
    if (!conversationId || xMessages.length === 0) return
    const messages = xMessagesToMessages(xMessages, conversationId)
    useConversationStore.getState().setMessages(conversationId, messages)
  }, [conversationId, xMessages])

  // 自动发送 pending message
  useEffect(() => {
    if (pendingSentRef.current) return
    if (!conversationId) return

    const pendingKey = getPendingMessageKey(conversationId)
    const raw = sessionStorage.getItem(pendingKey)
    if (!raw) return

    sessionStorage.removeItem(pendingKey)
    pendingSentRef.current = true

    let pending: PendingMessage
    try {
      pending = JSON.parse(raw) as PendingMessage
      if (typeof pending !== 'object' || pending === null || typeof pending.content !== 'string') {
        throw new Error('invalid pending format')
      }
    } catch {
      pending = { content: raw }
    }

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      onRequest({
        response_mode: 'streaming',
        query: pending.content.trim(),
        conversation_id: conversationId,
        provider_key: selectedProviderKey ?? undefined,
        knowledge_base_ids: pending.knowledgeBaseIds,
      } as GoferInput)
    })

    return () => {
      cancelled = true
    }
  }, [conversationId, onRequest, selectedProviderKey])

  const handleRetry = useCallback(() => {
    const lastUserMsg = [...xMessages].reverse().find((m) => m.message.role === 'user')
    if (lastUserMsg && conversationId) {
      onRequest({
        response_mode: 'streaming',
        query: lastUserMsg.message.content,
        conversation_id: conversationId,
        provider_key: selectedProviderKey ?? undefined,
        knowledge_base_ids: selectedKbId ? [selectedKbId] : undefined,
      } as GoferInput)
    }
  }, [xMessages, conversationId, onRequest, selectedProviderKey, selectedKbId])

  if (!tab) {
    return (
      <div className="flex h-full items-center justify-center text-text-secondary">
        正在恢复标签...
      </div>
    )
  }

  if (!conversationId) {
    return <ChatTempHome tabId={tabId} />
  }

  return (
    <XProvider>
      <ChatSessionView
        conversationId={conversationId}
        xMessages={xMessages}
        onRequest={(params) => onRequest(params as GoferInput)}
        isRequesting={isRequesting}
        onRetry={handleRetry}
        onAbort={abort}
        selectedProviderKey={selectedProviderKey}
        onChangeProvider={setSelectedProviderKey}
        selectedKbId={selectedKbId}
        onSelectKb={setSelectedKbId}
      />
    </XProvider>
  )
}
