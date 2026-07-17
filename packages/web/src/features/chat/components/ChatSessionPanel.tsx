import { XProvider } from '@ant-design/x'
import { useXChat } from '@ant-design/x-sdk'
import type { Message } from '@goferbot/data'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useConversationStore } from '@/stores/conversation.store'
import { getPendingMessageKey } from '../constants'
import type { GoferInput, GoferMessage } from '../providers/GoferChatProvider'
import type { PendingMessage } from '../services'
import {
  createGoferProvider,
  fetchProviders,
  loadChatHistory,
  resolveSessionById,
} from '../services'
import { useChatStore } from '../store'
import { ChatSessionView } from './ChatSessionView'

interface ChatSessionPanelProps {
  /** Session.id（来自 ?c=） */
  sessionId: string
  /** 固定注入的知识库（知识库页同屏问答）；不传则用户自选 */
  fixedKbIds?: string[]
  onSessionInvalid?: () => void
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

/**
 * 单会话消息区：绑定 Session.id，Abort + streamGeneration 竞态守卫。
 */
export function ChatSessionPanel({
  sessionId,
  fixedKbIds,
  onSessionInvalid,
}: ChatSessionPanelProps) {
  const pendingSentRef = useRef(false)
  const streamGenerationRef = useRef(0)
  const providerRef = useState(() => createGoferProvider())[0]
  /** 回调走 ref，避免进入 session 加载 effect 依赖导致无限重跑 */
  const onSessionInvalidRef = useRef(onSessionInvalid)
  onSessionInvalidRef.current = onSessionInvalid

  const selectedProviderKey = useChatStore((s) => s.selectedProviderKey)
  const setSelectedProviderKey = useChatStore((s) => s.setSelectedProviderKey)
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>(fixedKbIds ?? [])
  const [resolving, setResolving] = useState(true)

  const {
    messages: xMessages,
    onRequest,
    isRequesting,
    abort,
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
      return {
        content: '网络异常，请稍后重试',
        role: 'assistant',
      }
    },
  })

  const abortRef = useRef(abort)
  const setMessagesRef = useRef(setMessagesFn)

  useEffect(() => {
    abortRef.current = abort
    setMessagesRef.current = setMessagesFn
  }, [abort, setMessagesFn])

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

  const safeAbort = useCallback(() => {
    try {
      abortRef.current?.()
    } catch {
      // useXChat 内部 AbortController 可能尚未初始化
    }
  }, [])

  // 切换 session / 卸载：Abort + 提升 generation
  // 依赖仅 sessionId。abort / onSessionInvalid 经 ref 读取，禁止进 deps（useXChat 的 abort
  // 常随每次 render 换引用 → setState → 再 render → Maximum update depth）。
  useEffect(() => {
    const generation = ++streamGenerationRef.current
    pendingSentRef.current = false
    safeAbort()
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
            setMessagesRef.current?.(messagesToMessageInfos(cached.messages))
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
          setMessagesRef.current?.(messagesToMessageInfos(fresh))
        } catch {
          // ignore
        }
      }
      setResolving(false)
    })()

    return () => {
      cancelled = true
      streamGenerationRef.current++
      safeAbort()
    }
  }, [sessionId, safeAbort])

  useEffect(() => {
    if (!sessionId || xMessages.length === 0) return
    const messages = xMessagesToMessages(xMessages, sessionId)
    useConversationStore.getState().setMessages(sessionId, messages)
  }, [sessionId, xMessages])

  // Auto-send pending
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

    const kbIds =
      fixedKbIds?.length ? fixedKbIds : (pending.knowledgeBaseIds?.filter(Boolean) ?? [])
    if (kbIds.length) {
      setSelectedKbIds(kbIds)
    }
    if (kbIds.length === 0) return

    const generation = streamGenerationRef.current
    queueMicrotask(() => {
      if (generation !== streamGenerationRef.current) return
      onRequest({
        response_mode: 'streaming',
        query: pending.content.trim(),
        conversation_id: sessionId,
        provider_key: selectedProviderKey ?? undefined,
        knowledge_base_ids: kbIds,
        retrieval_mode: 'strict',
      } as GoferInput)
    })
  }, [sessionId, resolving, onRequest, selectedProviderKey, fixedKbIds])

  const handleRequest = useCallback(
    (params: GoferInput) => {
      const generation = streamGenerationRef.current
      const kbIds = fixedKbIds?.length ? fixedKbIds : params.knowledge_base_ids
      if (!kbIds?.length) {
        toast.error('请先选择至少一个知识库')
        return
      }
      if (generation !== streamGenerationRef.current) return
      onRequest({
        ...params,
        knowledge_base_ids: kbIds,
        conversation_id: sessionId,
      })
    },
    [onRequest, sessionId, fixedKbIds],
  )

  const handleViewRequest = useCallback(
    (params: unknown) => {
      handleRequest(params as GoferInput)
    },
    [handleRequest],
  )

  const handleRetry = useCallback(() => {
    const lastUserMsg = [...xMessages].reverse().find((m) => m.message.role === 'user')
    const kbIds = fixedKbIds?.length ? fixedKbIds : selectedKbIds
    if (lastUserMsg && sessionId && kbIds.length > 0) {
      handleRequest({
        response_mode: 'streaming',
        query: lastUserMsg.message.content,
        conversation_id: sessionId,
        provider_key: selectedProviderKey ?? undefined,
        knowledge_base_ids: kbIds,
        retrieval_mode: 'strict',
      } as GoferInput)
    }
  }, [xMessages, sessionId, handleRequest, selectedProviderKey, selectedKbIds, fixedKbIds])

  if (resolving && xMessages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-secondary">
        加载会话中…
      </div>
    )
  }

  return (
    <XProvider>
      <ChatSessionView
        conversationId={sessionId}
        xMessages={xMessages}
        onRequest={handleViewRequest}
        isRequesting={isRequesting}
        onRetry={handleRetry}
        onAbort={safeAbort}
        selectedProviderKey={selectedProviderKey}
        onChangeProvider={setSelectedProviderKey}
        selectedKbIds={selectedKbIds}
        onChangeKbIds={hasFixedKb ? NOOP_KB_CHANGE : setSelectedKbIds}
      />
    </XProvider>
  )
}
