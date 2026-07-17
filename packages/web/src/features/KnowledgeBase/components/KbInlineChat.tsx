import { XProvider } from '@ant-design/x'
import { useXChat } from '@ant-design/x-sdk'
import type { Message } from '@goferbot/data'
import { MessageSquare } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useConversationStore } from '@/stores/conversation.store'
import type { GoferInput, GoferMessage } from '@/features/chat/providers/GoferChatProvider'
import {
  createChatSession,
  createGoferProvider,
  fetchProviders,
  loadChatHistory,
} from '@/features/chat/services'
import { useChatStore } from '@/features/chat/store'
import { ChatSessionView } from '@/features/chat/components/ChatSessionView'

interface KbInlineChatProps {
  kbId: string
  kbName?: string
}

const NOOP_KB_CHANGE = () => {}

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

/**
 * 知识库同屏问答：固定 knowledge_base_ids = [kbId]，复用 Chat SSE。
 */
export function KbInlineChat({ kbId, kbName }: KbInlineChatProps) {
  const streamGenerationRef = useRef(0)
  const providerRef = useState(() => createGoferProvider())[0]
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const { selectedProviderKey, setSelectedProviderKey } = useChatStore()
  const fixedKbIds = useMemo(() => [kbId], [kbId])

  const {
    messages: xMessages,
    onRequest,
    isRequesting,
    abort: abortFn,
    setMessages: setMessagesFn,
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
      return { content: '网络异常，请稍后重试', role: 'assistant' }
    },
  })

  const abortRef = useRef(abortFn)
  const setMessagesRef = useRef(setMessagesFn)

  useEffect(() => {
    abortRef.current = abortFn
    setMessagesRef.current = setMessagesFn
  }, [abortFn, setMessagesFn])

  useEffect(() => {
    void fetchProviders()
  }, [])

  // 切换知识库：Abort + 重置会话
  useEffect(() => {
    streamGenerationRef.current++
    try {
      abortRef.current?.()
    } catch {
      // AbortController 可能未就绪
    }
    try {
      setMessagesRef.current?.([])
    } catch {
      // ignore
    }
    setSessionId(null)
    return () => {
      streamGenerationRef.current++
      try {
        abortRef.current?.()
      } catch {
        // ignore
      }
    }
  }, [kbId])

  useEffect(() => {
    if (!sessionId || xMessages.length === 0) return
    const messages = xMessages.map((xMsg, index) => ({
      id: typeof xMsg.id === 'string' ? xMsg.id : `msg-${index}`,
      sessionId,
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
    })) as Message[]
    useConversationStore.getState().setMessages(sessionId, messages)
  }, [sessionId, xMessages])

  const ensureSession = useCallback(async () => {
    if (sessionId) return sessionId
    setCreating(true)
    try {
      const session = await createChatSession()
      if (!session?.id) {
        toast.error('创建会话失败')
        return null
      }
      setSessionId(session.id)
      return session.id
    } finally {
      setCreating(false)
    }
  }, [sessionId])

  const handleRequest = useCallback(
    async (params: GoferInput) => {
      const generation = streamGenerationRef.current
      const id = await ensureSession()
      if (!id || generation !== streamGenerationRef.current) return
      onRequest({
        ...params,
        conversation_id: id,
        knowledge_base_ids: fixedKbIds,
        retrieval_mode: 'strict',
      })
    },
    [ensureSession, onRequest, fixedKbIds],
  )

  const handleViewRequest = useCallback(
    (params: unknown) => {
      void handleRequest(params as GoferInput)
    },
    [handleRequest],
  )

  const handleRetry = useCallback(() => {
    const lastUserMsg = [...xMessages].reverse().find((m) => m.message.role === 'user')
    if (lastUserMsg && sessionId) {
      void handleRequest({
        response_mode: 'streaming',
        query: lastUserMsg.message.content,
        conversation_id: sessionId,
        provider_key: selectedProviderKey ?? undefined,
        knowledge_base_ids: fixedKbIds,
        retrieval_mode: 'strict',
      })
    }
  }, [xMessages, sessionId, handleRequest, selectedProviderKey, fixedKbIds])

  // 恢复历史（若已有 session）
  useEffect(() => {
    if (!sessionId) return
    const generation = streamGenerationRef.current
    const cached = useConversationStore.getState().conversationMap[sessionId]
    if (cached?.messages.length) {
      setMessagesRef.current?.(messagesToMessageInfos(cached.messages))
      return
    }
    void loadChatHistory(sessionId).then(() => {
      if (generation !== streamGenerationRef.current) return
      const fresh = useConversationStore.getState().conversationMap[sessionId]?.messages ?? []
      if (fresh.length) setMessagesRef.current?.(messagesToMessageInfos(fresh))
    })
  }, [sessionId])

  return (
    <div
      className="flex h-full min-w-0 flex-col border-l border-border-subtle bg-surface-1"
      data-testid="kb-inline-chat"
    >
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
        <MessageSquare className="h-4 w-4 text-brand-blue" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">库内问答</p>
          <p className="truncate text-xs text-text-tertiary">
            {kbName ? `基于「${kbName}」` : '基于当前知识库'}
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <XProvider>
          <ChatSessionView
            conversationId={sessionId ?? ''}
            xMessages={xMessages}
            onRequest={handleViewRequest}
            isRequesting={isRequesting || creating}
            onRetry={handleRetry}
            onAbort={abortFn}
            selectedProviderKey={selectedProviderKey}
            onChangeProvider={setSelectedProviderKey}
            selectedKbIds={fixedKbIds}
            onChangeKbIds={NOOP_KB_CHANGE}
          />
        </XProvider>
      </div>
    </div>
  )
}
