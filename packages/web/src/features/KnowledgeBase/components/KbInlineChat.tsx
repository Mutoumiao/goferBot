import { useChat } from '@ai-sdk/react'
import { MessageSquare } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ChatSessionView } from '@/features/chat/components/ChatSessionView'
import { KnowledgeChatTransport } from '@/features/chat/knowledge-chat-transport'
import {
  historyMessageToUiMessage,
  textFromUiMessage,
  uiMessagesToMessages,
} from '@/features/chat/message-sources'
import { createChatSession, fetchProviders, loadChatHistory } from '@/features/chat/services'
import { useChatStore } from '@/features/chat/store'
import { useConversationStore } from '@/stores/conversation.store'

interface KbInlineChatProps {
  kbId: string
  kbName?: string
}

const NOOP_KB_CHANGE = () => {}

/**
 * 知识库同屏问答：固定 knowledge_base_ids = [kbId]，
 * 与 /chats 共享 KnowledgeChatTransport + useChat + sources 选择器。
 */
export function KbInlineChat({ kbId, kbName }: KbInlineChatProps) {
  const streamGenerationRef = useRef(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const sessionIdRef = useRef<string | null>(null)
  sessionIdRef.current = sessionId

  const selectedProviderKey = useChatStore((s) => s.selectedProviderKey)
  const setSelectedProviderKey = useChatStore((s) => s.setSelectedProviderKey)
  const selectedProviderKeyRef = useRef(selectedProviderKey)
  selectedProviderKeyRef.current = selectedProviderKey

  const fixedKbIds = useMemo(() => [kbId], [kbId])
  const fixedKbIdsRef = useRef(fixedKbIds)
  fixedKbIdsRef.current = fixedKbIds

  const transport = useMemo(
    () =>
      new KnowledgeChatTransport({
        getConversationId: () => sessionIdRef.current ?? '',
        getKnowledgeBaseIds: () => fixedKbIdsRef.current,
        getProviderKey: () => selectedProviderKeyRef.current ?? undefined,
      }),
    [],
  )

  const { messages, sendMessage, status, setMessages, stop, error, clearError } = useChat({
    id: sessionId ? `kb-${kbId}-${sessionId}` : `kb-${kbId}-pending`,
    transport,
    onError: (err) => {
      toast.error(err.message || '对话失败')
    },
  })

  const isStreaming = status === 'submitted' || status === 'streaming'

  const stopRef = useRef(stop)
  const setMessagesRef = useRef(setMessages)
  const sendMessageRef = useRef(sendMessage)
  const clearErrorRef = useRef(clearError)

  useEffect(() => {
    stopRef.current = stop
    setMessagesRef.current = setMessages
    sendMessageRef.current = sendMessage
    clearErrorRef.current = clearError
  }, [stop, setMessages, sendMessage, clearError])

  useEffect(() => {
    void fetchProviders()
  }, [])

  // 切换知识库：stop + 重置会话
  useEffect(() => {
    streamGenerationRef.current++
    try {
      stopRef.current?.()
    } catch {
      // ignore
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
        stopRef.current?.()
      } catch {
        // ignore
      }
    }
  }, [kbId])

  // 仅在非流式时同步缓存
  useEffect(() => {
    if (!sessionId || messages.length === 0) return
    if (status === 'submitted' || status === 'streaming') return
    const prev = useConversationStore.getState().conversationMap[sessionId]?.messages
    const mapped = uiMessagesToMessages(messages, sessionId, prev)
    useConversationStore.getState().setMessages(sessionId, mapped)
  }, [sessionId, messages, status])

  useEffect(() => {
    if (!error) return
    clearErrorRef.current?.()
  }, [error])

  const ensureSession = useCallback(async () => {
    if (sessionIdRef.current) return sessionIdRef.current
    setCreating(true)
    try {
      const session = await createChatSession()
      if (!session?.id) {
        toast.error('创建会话失败')
        return null
      }
      setSessionId(session.id)
      sessionIdRef.current = session.id
      return session.id
    } finally {
      setCreating(false)
    }
  }, [])

  const handleSend = useCallback(async (text: string) => {
    const generation = streamGenerationRef.current
    const trimmed = text.trim()
    if (!trimmed) return
    const id = await ensureSession()
    if (!id || generation !== streamGenerationRef.current) return
    await sendMessageRef.current(
      { text: trimmed },
      {
        body: {
          conversation_id: id,
          knowledge_base_ids: fixedKbIdsRef.current,
          provider_key: selectedProviderKeyRef.current ?? undefined,
          retrieval_mode: 'strict',
        },
      },
    )
  }, [ensureSession])

  const handleRetry = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUserMsg && sessionIdRef.current) {
      void handleSend(textFromUiMessage(lastUserMsg))
    }
  }, [messages, handleSend])

  const handleAbort = useCallback(() => {
    try {
      stopRef.current?.()
    } catch {
      // ignore
    }
  }, [])

  // 恢复历史（若已有 session）
  useEffect(() => {
    if (!sessionId) return
    const generation = streamGenerationRef.current
    const cached = useConversationStore.getState().conversationMap[sessionId]
    if (cached?.messages.length) {
      setMessagesRef.current?.(cached.messages.map(historyMessageToUiMessage))
      return
    }
    void loadChatHistory(sessionId).then(() => {
      if (generation !== streamGenerationRef.current) return
      const fresh = useConversationStore.getState().conversationMap[sessionId]?.messages ?? []
      if (fresh.length) setMessagesRef.current?.(fresh.map(historyMessageToUiMessage))
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
        <ChatSessionView
          conversationId={sessionId ?? ''}
          messages={messages}
          isStreaming={isStreaming || creating}
          onSend={handleSend}
          onRetry={handleRetry}
          onAbort={handleAbort}
          selectedProviderKey={selectedProviderKey}
          onChangeProvider={setSelectedProviderKey}
          selectedKbIds={fixedKbIds}
          onChangeKbIds={NOOP_KB_CHANGE}
        />
      </div>
    </div>
  )
}
