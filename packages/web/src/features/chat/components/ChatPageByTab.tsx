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
  return messages.map((message) => {
    const meta = message.metadata as
      | { sources?: GoferMessage['sources']; retrieval_empty?: boolean }
      | null
      | undefined
    return {
      id: message.id,
      message: {
        content: message.content,
        role: message.role as GoferMessage['role'],
        sources: meta?.sources,
        retrieval_empty: meta?.retrieval_empty,
      },
      status: 'success' as const,
    }
  })
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
    metadata:
      xMsg.message.sources || xMsg.message.retrieval_empty
        ? {
            sources: xMsg.message.sources,
            retrieval_empty: xMsg.message.retrieval_empty,
          }
        : undefined,
  }))
}

export function ChatPageByTab({ tabId }: ChatPageByTabProps) {
  const tab = useWorkspaceStore((s) => s.tabs.find((t) => t.id === tabId))
  const pendingSentRef = useRef(false)
  const prevConversationIdRef = useRef<string | undefined>(undefined)

  const providerRef = useState(() => createGoferProvider())[0]

  const conversationId = tab?.conversationId

  const { selectedProviderKey, setSelectedProviderKey } = useChatStore()
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([])

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
          sources: messageInfo?.message?.sources,
          retrieval_empty: messageInfo?.message?.retrieval_empty,
        }
      }
      return {
        content: '网络异常，请稍后重试',
        role: 'assistant',
      }
    },
  })

  useEffect(() => {
    fetchProviders()
  }, [])

  useEffect(() => {
    pendingSentRef.current = false
  }, [])

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

  useEffect(() => {
    if (!conversationId || xMessages.length === 0) return
    const messages = xMessagesToMessages(xMessages, conversationId)
    useConversationStore.getState().setMessages(conversationId, messages)
  }, [conversationId, xMessages])

  // Auto-send pending; restore KB selection from pending payload
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

    const kbIds = pending.knowledgeBaseIds?.filter(Boolean) ?? []
    if (kbIds.length) {
      setSelectedKbIds(kbIds)
    }

    if (kbIds.length === 0) {
      // Cannot call Knowledge AI without KB — leave message for user to pick KB and resend
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      onRequest({
        response_mode: 'streaming',
        query: pending.content.trim(),
        conversation_id: conversationId,
        provider_key: selectedProviderKey ?? undefined,
        knowledge_base_ids: kbIds,
        retrieval_mode: 'strict',
      } as GoferInput)
    })

    return () => {
      cancelled = true
    }
  }, [conversationId, onRequest, selectedProviderKey])

  const handleRetry = useCallback(() => {
    const lastUserMsg = [...xMessages].reverse().find((m) => m.message.role === 'user')
    if (lastUserMsg && conversationId && selectedKbIds.length > 0) {
      onRequest({
        response_mode: 'streaming',
        query: lastUserMsg.message.content,
        conversation_id: conversationId,
        provider_key: selectedProviderKey ?? undefined,
        knowledge_base_ids: selectedKbIds,
        retrieval_mode: 'strict',
      } as GoferInput)
    }
  }, [xMessages, conversationId, onRequest, selectedProviderKey, selectedKbIds])

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
        selectedKbIds={selectedKbIds}
        onChangeKbIds={setSelectedKbIds}
      />
    </XProvider>
  )
}
