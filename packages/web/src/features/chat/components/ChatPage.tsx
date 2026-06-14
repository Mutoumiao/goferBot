import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { XProvider } from '@ant-design/x'
import { useXChat } from '@ant-design/x-sdk'
import { createGoferProvider, fetchProviders, loadChatHistory, resolveSessionById } from '../services'
import type { GoferMessage, GoferInput } from '../providers/GoferChatProvider'
import { useChatStore } from '../store'
import { useTabsStore } from '@/stores/tabs'
import { getPendingMessageKey } from '../constants'
import { ChatTempHome } from './ChatTempHome'
import { ChatSessionView } from './ChatSessionView'

interface ChatPageProps {
  sessionId: string
  isTemp: boolean
}

export function ChatPage({ sessionId, isTemp }: ChatPageProps) {
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([])
  /** 标记 pending message 是否已处理，防止重复发送 */
  const pendingSentRef = useRef(false)
  /** 跟踪当前 sessionId，用于判断是否需要重置状态 */
  const currentSessionIdRef = useRef(sessionId)

  const navigate = useNavigate()

  const { activeSession, setActiveSession, setSelectedProviderKey } = useChatStore()

  const providerRef = useState(() => createGoferProvider())[0]

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

  // 初始化 providers（只在首次加载时请求）
  useEffect(() => {
    fetchProviders()
  }, [])

  // sessionId 变化时：重置 pendingSentRef，从缓存恢复或清空消息
  useEffect(() => {
    if (sessionId !== currentSessionIdRef.current) {
      pendingSentRef.current = false
      currentSessionIdRef.current = sessionId

      if (!isTemp) {
        const store = useChatStore.getState()
        const cached = store.getCachedMessages(sessionId)
        if (cached) {
          // 从缓存恢复消息
          const messageInfos = cached.map((message) => ({
            id: message.id,
            message: {
              content: message.content,
              role: message.role as GoferMessage['role'],
            },
            status: 'success' as const,
          }))
          setMessages(messageInfos)
        } else {
          setMessages([])
        }
      }
    }
  }, [sessionId, isTemp, setMessages])

  // 根据 isTemp 和 sessionId 同步 activeSession 状态
  useEffect(() => {
    if (isTemp) {
      setActiveSession(null)
      return
    }
    // 非临时会话但 activeSession 未匹配时：
    // 路由 loader 已调用 getSessionById 并设置 activeSession，
    // 此处仅处理从会话历史直接打开等边界情况
    if (activeSession?.id !== sessionId) {
      // 兜底：若路由 loader 未成功设置 activeSession，主动请求会话详情
      // 但仅在非临时会话时兜底，避免会话不存在时重复请求
      resolveSessionById(sessionId).catch(() => {
        // 降级为临时会话，避免页面卡死
        setActiveSession(null)
      })
    }
  }, [sessionId, isTemp, setActiveSession, activeSession?.id])

  // 加载历史消息：仅在非临时会话且 activeSession 就绪时触发
  useEffect(() => {
    if (isTemp || !activeSession?.id) return
    // 如果当前 activeSession 不是目标 sessionId，不加载（等待 activeSession 同步）
    if (activeSession.id !== sessionId) return

    const store = useChatStore.getState()
    // 如果该会话已经加载过历史消息，从缓存恢复，不再请求 API
    if (store.isSessionLoaded(sessionId)) {
      const cached = store.getCachedMessages(sessionId)
      if (cached) {
        const messageInfos = cached.map((message) => ({
          id: message.id,
          message: {
            content: message.content,
            role: message.role as GoferMessage['role'],
          },
          status: 'success' as const,
        }))
        setMessages(messageInfos)
      }
      return
    }

    // 首次加载：请求 API 并缓存
    loadChatHistory(activeSession.id).then(() => {
      const freshMessages = useChatStore.getState().messages
      useChatStore.getState().setCachedMessages(sessionId, freshMessages)
      useChatStore.getState().setSessionLoaded(sessionId, true)
      const messageInfos = freshMessages.map((message) => ({
        id: message.id,
        message: {
          content: message.content,
          role: message.role as GoferMessage['role'],
        },
        status: 'success' as const,
      }))
      setMessages(messageInfos)
    })
  }, [activeSession?.id, sessionId, isTemp, setMessages])

  // 同步标签标题：当 activeSession 加载完成后，更新标签标题（BUG2 修复）
  useEffect(() => {
    if (!activeSession?.id || activeSession.id !== sessionId) return
    if (!activeSession.title) return

    const tabsStore = useTabsStore.getState()
    const tab = tabsStore.tabs.find((t) => t.sessionId === sessionId)
    if (tab && tab.title !== activeSession.title) {
      tabsStore.renameTab(tab.id, activeSession.title)
    }
  }, [activeSession?.id, activeSession?.title, sessionId])

  // 自动发送 pending message：当 activeSession 就绪后触发
  useEffect(() => {
    if (pendingSentRef.current) return
    if (!isTemp && activeSession?.id) {
      const pendingKey = getPendingMessageKey(activeSession.id)
      const pending = sessionStorage.getItem(pendingKey)
      if (pending) {
        sessionStorage.removeItem(pendingKey)
        pendingSentRef.current = true
        // 使用 queueMicrotask 确保在当前渲染周期之后发送，
        // 避免 useXChat 内部状态尚未就绪的问题
        queueMicrotask(() => {
          const sid = activeSession.id
          const providerKey = useChatStore.getState().selectedProviderKey ?? undefined
          onRequest({
            response_mode: 'streaming',
            query: pending.trim(),
            conversation_id: sid,
            knowledge_base_ids: [],
            provider_key: providerKey,
          } as GoferInput)
        })
      }
    }
  }, [activeSession?.id, isTemp, onRequest])

  const handleRetry = useCallback(() => {
    const lastUserMsg = [...xMessages].reverse().find((m) => m.message.role === 'user')
    if (lastUserMsg && activeSession?.id) {
      onRequest({
        response_mode: 'streaming',
        query: lastUserMsg.message.content,
        conversation_id: activeSession.id,
        knowledge_base_ids: selectedKbIds,
        provider_key: useChatStore.getState().selectedProviderKey ?? undefined,
      } as GoferInput)
    }
  }, [xMessages, activeSession?.id, onRequest, selectedKbIds])

  const handleToggleKb = useCallback((kbId: string) => {
    setSelectedKbIds((prev) => (prev.includes(kbId) ? prev.filter((id) => id !== kbId) : [...prev, kbId]))
  }, [])

  const handleNavigateToSession = useCallback(
    (newSessionId: string) => {
      navigate({
        to: '/chat/$sessionId',
        params: { sessionId: newSessionId },
        replace: true,
      })
    },
    [navigate],
  )

  if (isTemp) {
    return <ChatTempHome onNavigateToSession={handleNavigateToSession} />
  }

  return (
    <XProvider>
      <ChatSessionView
        sessionId={sessionId}
        xMessages={xMessages}
        onRequest={(params) => onRequest(params as GoferInput)}
        isRequesting={isRequesting}
        onRetry={handleRetry}
        onAbort={abort}
        selectedKbIds={selectedKbIds}
        selectedProviderKey={useChatStore.getState().selectedProviderKey}
        onToggleKb={handleToggleKb}
        onChangeProvider={setSelectedProviderKey}
      />
    </XProvider>
  )
}
