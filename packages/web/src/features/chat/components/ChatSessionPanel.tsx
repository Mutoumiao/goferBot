import { useChat } from '@ai-sdk/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useConversationStore } from '@/stores/conversation.store'
import { getPendingMessageKey } from '../constants'
import { KnowledgeChatTransport } from '../knowledge-chat-transport'
import {
  historyMessageToUiMessage,
  textFromUiMessage,
  uiMessagesToMessages,
} from '../message-sources'
import type { PendingMessage } from '../services'
import { fetchProviders, loadChatHistory, resolveSessionById } from '../services'
import { useChatStore } from '../store'
import { ChatSessionView } from './ChatSessionView'

interface ChatSessionPanelProps {
  /** Session.id（来自 chatStore.selectedSessionId，不写 URL） */
  sessionId: string
  /** 固定注入的知识库（知识库页同屏问答）；不传则用户自选 */
  fixedKbIds?: string[]
  onSessionInvalid?: () => void
}

const NOOP_KB_CHANGE = () => {}

/**
 * 单会话消息区：I2 实例模型 — useChat 生命周期绑定 sessionId 挂载。
 * 切换/卸载时 stop/abort；历史经 setMessages hydrate。
 */
export function ChatSessionPanel({
  sessionId,
  fixedKbIds,
  onSessionInvalid,
}: ChatSessionPanelProps) {
  const pendingSentRef = useRef(false)
  const streamGenerationRef = useRef(0)
  /** 回调走 ref，避免进入 session 加载 effect 依赖导致无限重跑 */
  const onSessionInvalidRef = useRef(onSessionInvalid)
  onSessionInvalidRef.current = onSessionInvalid

  const selectedProviderKey = useChatStore((s) => s.selectedProviderKey)
  const setSelectedProviderKey = useChatStore((s) => s.setSelectedProviderKey)
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>(fixedKbIds ?? [])
  const [resolving, setResolving] = useState(true)

  const selectedKbIdsRef = useRef(selectedKbIds)
  const selectedProviderKeyRef = useRef(selectedProviderKey)
  selectedKbIdsRef.current = selectedKbIds
  selectedProviderKeyRef.current = selectedProviderKey

  const transport = useMemo(
    () =>
      new KnowledgeChatTransport({
        getConversationId: () => sessionId,
        getKnowledgeBaseIds: () => selectedKbIdsRef.current,
        getProviderKey: () => selectedProviderKeyRef.current ?? undefined,
      }),
    [sessionId],
  )

  const { messages, sendMessage, status, setMessages, stop, error, clearError } = useChat({
    id: sessionId,
    transport,
    onError: (err) => {
      // 传输错误唯一 toast 出口（勿再在 error effect 里 toast）
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

  // fixedKbIds 同步（仅内容变化时写 state，避免父级每次新数组引用触发重渲染环）
  const fixedKbKey = fixedKbIds?.join(',') ?? ''
  useEffect(() => {
    if (!fixedKbKey) return
    setSelectedKbIds(fixedKbKey.split(',').filter(Boolean))
  }, [fixedKbKey])

  const hasFixedKb = Boolean(fixedKbIds?.length)

  const safeStop = useCallback(() => {
    try {
      stopRef.current?.()
    } catch {
      // stop 可能在未开始时调用
    }
  }, [])

  // 切换 session / 卸载：stop + 提升 generation
  // 依赖仅 sessionId。stop / onSessionInvalid 经 ref 读取，禁止进 deps。
  useEffect(() => {
    const generation = ++streamGenerationRef.current
    pendingSentRef.current = false
    safeStop()
    try {
      setMessagesRef.current?.([])
    } catch {
      // ignore
    }
    setResolving(true)

    let cancelled = false

    ;(async () => {
      const session = await resolveSessionById(sessionId)
      if (cancelled || generation !== streamGenerationRef.current) return

      if (!session) {
        toast.error('会话不存在或无权访问')
        onSessionInvalidRef.current?.()
        return
      }

      const conversationStore = useConversationStore.getState()
      const cached = conversationStore.conversationMap[sessionId]
      if (cached?.messages.length) {
        if (generation === streamGenerationRef.current) {
          try {
            setMessagesRef.current?.(cached.messages.map(historyMessageToUiMessage))
          } catch {
            // ignore
          }
          setResolving(false)
        }
        return
      }

      const pendingKey = getPendingMessageKey(sessionId)
      const hasPending = !!sessionStorage.getItem(pendingKey)
      if (!hasPending && generation === streamGenerationRef.current) {
        try {
          setMessagesRef.current?.([])
        } catch {
          // ignore
        }
      }

      await loadChatHistory(sessionId)
      if (cancelled || generation !== streamGenerationRef.current) return

      const fresh = useConversationStore.getState().conversationMap[sessionId]?.messages ?? []
      if (fresh.length) {
        try {
          setMessagesRef.current?.(fresh.map(historyMessageToUiMessage))
        } catch {
          // ignore
        }
      }
      setResolving(false)
    })()

    return () => {
      cancelled = true
      streamGenerationRef.current++
      safeStop()
    }
  }, [sessionId, safeStop])

  // 仅在非流式时同步到 conversationStore，避免每个 token 写全局缓存
  useEffect(() => {
    if (!sessionId || messages.length === 0) return
    if (status === 'submitted' || status === 'streaming') return
    const prev = useConversationStore.getState().conversationMap[sessionId]?.messages
    const mapped = uiMessagesToMessages(messages, sessionId, prev)
    useConversationStore.getState().setMessages(sessionId, mapped)
  }, [sessionId, messages, status])

  // 清除 residual error 状态，不再二次 toast
  useEffect(() => {
    if (!error) return
    clearErrorRef.current?.()
  }, [error])

  const sendKnowledgeQuery = useCallback(
    async (query: string, kbIds: string[]) => {
      const generation = streamGenerationRef.current
      const trimmed = query.trim()
      if (!trimmed || !kbIds.length) return
      if (generation !== streamGenerationRef.current) return
      await sendMessageRef.current(
        { text: trimmed },
        {
          body: {
            conversation_id: sessionId,
            knowledge_base_ids: kbIds,
            provider_key: selectedProviderKeyRef.current ?? undefined,
            retrieval_mode: 'strict',
          },
        },
      )
    },
    [sessionId],
  )

  // Auto-send pending（同一 useChat 发送路径）
  useEffect(() => {
    if (pendingSentRef.current) return
    if (!sessionId || resolving) return

    const pendingKey = getPendingMessageKey(sessionId)
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

    const kbIds = fixedKbIds?.length
      ? fixedKbIds
      : (pending.knowledgeBaseIds?.filter(Boolean) ?? [])
    if (kbIds.length) {
      setSelectedKbIds(kbIds)
    }
    if (kbIds.length === 0) {
      toast.error('请先选择至少一个知识库')
      return
    }

    const generation = streamGenerationRef.current
    queueMicrotask(() => {
      if (generation !== streamGenerationRef.current) return
      void sendKnowledgeQuery(pending.content, kbIds)
    })
  }, [sessionId, resolving, fixedKbIds, sendKnowledgeQuery])

  const handleSend = useCallback(
    (text: string) => {
      const generation = streamGenerationRef.current
      const kbIds = fixedKbIds?.length ? fixedKbIds : selectedKbIds
      if (!kbIds?.length) {
        toast.error('请先选择至少一个知识库')
        return
      }
      if (generation !== streamGenerationRef.current) return
      void sendKnowledgeQuery(text, kbIds)
    },
    [fixedKbIds, selectedKbIds, sendKnowledgeQuery],
  )

  const handleRetry = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    const kbIds = fixedKbIds?.length ? fixedKbIds : selectedKbIds
    if (lastUserMsg && sessionId && kbIds.length > 0) {
      void sendKnowledgeQuery(textFromUiMessage(lastUserMsg), kbIds)
    }
  }, [messages, sessionId, selectedKbIds, fixedKbIds, sendKnowledgeQuery])

  if (resolving && messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-secondary">
        加载会话中…
      </div>
    )
  }

  return (
    <ChatSessionView
      conversationId={sessionId}
      messages={messages}
      isStreaming={isStreaming}
      onSend={handleSend}
      onRetry={handleRetry}
      onAbort={safeStop}
      selectedProviderKey={selectedProviderKey}
      onChangeProvider={setSelectedProviderKey}
      selectedKbIds={selectedKbIds}
      onChangeKbIds={hasFixedKb ? NOOP_KB_CHANGE : setSelectedKbIds}
    />
  )
}
