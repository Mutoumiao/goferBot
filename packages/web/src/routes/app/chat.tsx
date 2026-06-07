import { useCallback, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useRequest } from 'alova/client'
import { getHistory } from '@/api/chat'
import { useChatStore } from '@/stores/chat'
import { ChatInput } from '@/components/chat/ChatInput'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { EditorPlaceholder } from '@/components/chat/EditorPlaceholder'

export const Route = createFileRoute('/app/chat')({
  component: ChatViewPage,
})

function ChatViewPage() {
  const {
    activeSession,
    messages,
    streamingContent,
    isStreaming,
    setMessages,
    appendMessage,
    setIsLoadingHistory,
    isLoadingHistory,
  } = useChatStore()

  // 加载历史消息（仅当有活跃 session 时）
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

  const handleSend = useCallback(
    (content: string) => {
      if (!content.trim()) return

      // 添加用户消息到列表
      const userMsg = {
        id: `msg-${Date.now()}`,
        sessionId: activeSession?.id ?? '',
        role: 'user' as const,
        content,
        createdAt: new Date().toISOString(),
      }
      appendMessage(userMsg)

      // TODO: SSE 流式调用（useSSE hook）— send content to backend
      // 当前占位：模拟 AI 回复（后端就绪后替换为 useSSE）
    },
    [activeSession, appendMessage],
  )

  return (
    <div className="flex h-full flex-col">
      {/* 会话标题栏 */}
      <div className="flex h-12 items-center border-b border-border-default bg-surface-1 px-4">
        <h2 className="text-sm font-medium text-text-primary">
          {activeSession?.title ?? '新对话'}
        </h2>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingHistory && (
          <div className="flex items-center justify-center py-8 text-sm text-text-secondary">
            加载中...
          </div>
        )}

        {!isLoadingHistory && messages.length === 0 && !streamingContent && (
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

        {/* 流式加载指示器 */}
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
      </div>

      {/* 输入框 */}
      <ChatInput
        onSend={handleSend}
        disabled={isStreaming}
        placeholder={activeSession ? '继续对话...' : '输入消息开始新对话...'}
      />
    </div>
  )
}
