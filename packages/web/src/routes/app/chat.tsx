import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useRequest, useSSE } from 'alova/client'
import { getHistory, streamChat } from '@/api/chat'
import { useChatStore } from '@/stores/chat'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { getLLMConfig, type LLMConfig } from '@/utils/llm-config'
import { parseSSEChunk } from '@/utils/sse-parser'
import { ChatInput } from '@/components/chat/ChatInput'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { EditorPlaceholder } from '@/components/chat/EditorPlaceholder'
import { SessionList } from '@/components/chat/SessionList'
import { openDialog } from '@/overlays/services/overlay-service'
import { DeleteSessionDialog } from '@/overlays/dialogs/DeleteSessionDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircleIcon, XIcon } from 'lucide-react'

export const Route = createFileRoute('/app/chat')({
  component: ChatViewPage,
})

/** LLM 配置回退值 — settingsStore 未配置时使用 */
const FALLBACK_LLM_CONFIG: LLMConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
}

export function ChatViewPage() {
  const search = useSearch({ from: '/app/chat' })
  const sessionIdFromUrl = typeof search === 'object' && search !== null
    ? (search as Record<string, unknown>).session as string | undefined
    : undefined

  const {
    activeSession,
    sessions,
    messages,
    streamingContent,
    isStreaming,
    setMessages,
    appendMessage,
    setIsLoadingHistory,
    isLoadingHistory,
    setIsStreaming,
    appendStreamContent,
    flushStreamContent,
    createSession,
    error,
    renameSession,
    deleteSession,
    clearError,
    loadSessions,
    setActiveSession,
  } = useChatStore()

  const renameTab = useTabsStore((s) => s.renameTab)
  const updateActiveTabSession = useTabsStore((s) => s.updateActiveTabSession)

  // LLM 配置（从 settingsStore 读取，未配置时回退默认值）
  const settingsConfig = useSettingsStore((s) => s.config)
  const llmConfig = getLLMConfig(settingsConfig) ?? FALLBACK_LLM_CONFIG

  // 错误状态
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorRetryMessage, setErrorRetryMessage] = useState<string | null>(null)

  // 重命名 inline 编辑状态
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  // 首次加载会话列表
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // 根据 URL session 参数设置活跃会话
  useEffect(() => {
    if (!sessionIdFromUrl) {
      // URL 无 session 参数，清空活跃会话（首页状态）
      setActiveSession(null)
      return
    }
    if (sessionIdFromUrl === 'new') {
      // 新建会话模式
      createSession().then((newSession) => {
        if (newSession) {
          setActiveSession(newSession)
          updateActiveTabSession(newSession.id, newSession.title)
        }
      })
      return
    }
    // 已有会话模式：从 sessions 中查找
    const target = sessions.find((s) => s.id === sessionIdFromUrl)
    if (target) {
      setActiveSession(target)
    } else {
      // 会话不在列表中，尝试加载后查找
      loadSessions().then(() => {
        const refreshed = useChatStore.getState().sessions.find((s) => s.id === sessionIdFromUrl)
        if (refreshed) {
          setActiveSession(refreshed)
        }
      })
    }
  }, [sessionIdFromUrl, sessions, setActiveSession, createSession, loadSessions])

  // Error toast 自动消失
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => clearError(), 5000)
    return () => clearTimeout(timer)
  }, [error, clearError])

  // 加载历史消息
  const { send: loadHistory } = useRequest(
    () => getHistory(activeSession?.id ?? ''),
    { immediate: false },
  )

  useEffect(() => {
    if (activeSession?.id) {
      setIsLoadingHistory(true)
      loadHistory().then((res) => {
        const data = (res as { data?: { messages?: unknown[] } })?.data
        if (data?.messages) {
          setMessages(data.messages as never[])
        }
        setIsLoadingHistory(false)
      }).catch(() => {
        setIsLoadingHistory(false)
      })
    }
  }, [activeSession?.id])

  // SSE hook
  const { send: sseSend, close: sseClose, onMessage, onError } = useSSE(
    (message: string, sessionId: string, config: LLMConfig, knowledgeBaseIds?: string[]) =>
      streamChat({
        message,
        sessionId,
        knowledgeBaseIds: knowledgeBaseIds ?? [],
        config,
      }),
    {
      interceptByGlobalResponded: false,
      immediate: false,
      reconnectionTime: 3000,
    },
  )

  // 绑定 SSE 消息处理
  onMessage((event: { data: string }) => {
    const parsed = parseSSEChunk(event)
    if (!parsed) return

    if (parsed.error) {
      setErrorMessage(parsed.error)
      setIsStreaming(false)
      return
    }
    if (parsed.done) {
      flushStreamContent()
      setIsStreaming(false)
    } else {
      appendStreamContent(parsed.chunk)
    }
  })

  onError((event: { error: Error }) => {
    setErrorMessage(event.error?.message ?? '网络连接失败，请检查网络后重试')
    setIsStreaming(false)
  })

  const handleSend = useCallback(
    async (content: string, knowledgeBaseIds?: string[]) => {
      if (!content.trim()) return

      // 清除上一次错误
      setErrorMessage(null)

      // 添加用户消息到列表
      const userMsg = {
        id: `msg-${Date.now()}`,
        sessionId: activeSession?.id ?? '',
        role: 'user' as const,
        content,
        createdAt: new Date().toISOString(),
      }
      appendMessage(userMsg)

      // 保存最近一次发送的消息内容用于错误重试
      setErrorRetryMessage(content)

      // 清理上一次流式残留内容（如 onError 后未 flush 的旧 chunk）
      if (streamingContent) {
        useChatStore.setState({ streamingContent: '' })
      }

      // 进入流式状态
      setIsStreaming(true)

      // 若无活跃会话，先创建新会话再发送 SSE
      let sessionId = activeSession?.id
      if (!sessionId) {
        const newSession = await createSession()
        sessionId = newSession?.id
        if (newSession) {
          updateActiveTabSession(newSession.id, newSession.title)
        }
      }

      // 发起 SSE 请求
      sseSend(content, sessionId ?? '', llmConfig, knowledgeBaseIds)
    },
    [activeSession, appendMessage, setIsStreaming, sseSend, createSession, llmConfig, streamingContent, updateActiveTabSession],
  )

  const handleStop = useCallback(() => {
    sseClose()
    flushStreamContent()
    setIsStreaming(false)
  }, [sseClose, flushStreamContent, setIsStreaming])

  const handleRetry = useCallback(() => {
    if (!errorRetryMessage) return
    setErrorMessage(null)
    handleSend(errorRetryMessage)
  }, [errorRetryMessage, handleSend])

  // 删除会话
  const handleDeleteSession = useCallback(
    async (sessionId: string, sessionTitle: string) => {
      const result = await openDialog<'confirm' | undefined>(
        DeleteSessionDialog,
        { sessionTitle },
      )
      if (result === 'confirm') {
        await deleteSession(sessionId)
      }
    },
    [deleteSession],
  )

  // 进入重命名模式
  const handleStartRename = useCallback(() => {
    if (!activeSession) return
    setRenameValue(activeSession.title)
    setIsRenaming(true)
  }, [activeSession])

  // 确认重命名
  const handleConfirmRename = useCallback(async () => {
    const trimmed = renameValue.trim()
    if (!trimmed || !activeSession) {
      setIsRenaming(false)
      return
    }
    if (trimmed !== activeSession.title) {
      await renameSession(activeSession.id, trimmed)
      // 同步更新标签标题
      renameTab(activeSession.id, trimmed)
    }
    setIsRenaming(false)
  }, [renameValue, activeSession, renameSession, renameTab])

  // 取消重命名
  const handleCancelRename = useCallback(() => {
    setIsRenaming(false)
    setRenameValue('')
  }, [])

  return (
    <div className="flex h-full">
      {/* 左侧会话列表 */}
      <div className="w-64 shrink-0">
        <SessionList
          onRenameClick={() => {
            // 内联重命名通过双击标题触发，这里预留
          }}
          onDeleteClick={(session) => {
            handleDeleteSession(session.id, session.title)
          }}
        />
      </div>

      {/* 右侧聊天区 */}
      <div className="flex flex-1 flex-col">
        {/* 会话标题栏 */}
        <div className="flex h-12 items-center border-b border-border-default bg-surface-1 px-4">
          {isRenaming && activeSession ? (
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleConfirmRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmRename()
                if (e.key === 'Escape') handleCancelRename()
              }}
              className="h-7 w-64 text-sm font-medium"
              autoFocus
            />
          ) : (
            <h2
              className="cursor-pointer text-sm font-medium text-text-primary hover:text-brand-primary"
              onDoubleClick={handleStartRename}
              title="双击重命名"
            >
              {activeSession?.title ?? '新对话'}
            </h2>
          )}
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingHistory && (
            <div className="flex items-center justify-center py-8 text-sm text-text-secondary">
              加载中...
            </div>
          )}

          {!isLoadingHistory && messages.length === 0 && !streamingContent && !errorMessage && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <h3 className="text-lg font-medium text-text-primary">开始新对话</h3>
                <p className="mt-2 text-sm text-text-secondary">
                  在下方输入消息，开始与 AI 对话
                </p>
                <EditorPlaceholder className="mt-6 mx-4" />
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* SSE 流式接收中的临时内容 */}
          {isStreaming && streamingContent && (
            <MessageBubble
              message={{
                id: 'streaming',
                sessionId: activeSession?.id ?? '',
                role: 'assistant',
                content: streamingContent,
                createdAt: new Date().toISOString(),
              }}
            />
          )}

          {/* 流式加载指示器（首 chunk 到达前） */}
          {isStreaming && !streamingContent && (
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="h-8 w-8 rounded-full bg-surface-3" />
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary [animation-delay:0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary [animation-delay:0.3s]" />
              </div>
            </div>
          )}

          {/* ErrorCard — SSE 连接失败 */}
          {errorMessage && (
            <div className="mx-4 my-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <p className="text-sm text-destructive-foreground">{errorMessage}</p>
              <Button
                data-testid="error-retry-btn"
                variant="destructive"
                size="sm"
                onClick={handleRetry}
                className="mt-2"
              >
                重试
              </Button>
            </div>
          )}
        </div>

        {/* 输入框 */}
        <ChatInput
          onSend={handleSend}
          isStreaming={isStreaming}
          onStop={handleStop}
          placeholder={activeSession ? '继续对话...' : '输入消息开始新对话...'}
        />

        {/* Error toast */}
        {error && (
          <div className="absolute bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-danger-600/20 bg-white px-4 py-2.5 text-sm text-danger-600 shadow-xl">
            <AlertCircleIcon className="size-4" />
            <span>{error}</span>
            <Button
              data-testid="error-toast-close"
              variant="ghost"
              size="icon-xs"
              onClick={clearError}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
