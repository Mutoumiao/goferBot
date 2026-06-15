import { useState, useCallback, useEffect } from 'react'
import { Bubble, Sender } from '@ant-design/x'
import { XMarkdown } from '@ant-design/x-markdown'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircleIcon, XIcon, Paperclip } from 'lucide-react'
import type { GoferMessage, GoferInput } from '../providers/GoferChatProvider'
import { useChatStore } from '../store'
import { fetchProviders } from '../services'
import { ProviderSelector } from './ProviderSelector'

interface ChatSessionViewProps {
  sessionId: string
  xMessages: {
    id: number | string
    message: GoferMessage
    status: 'loading' | 'success' | 'error' | 'local' | 'updating' | 'abort'
  }[]
  onRequest: (params: GoferInput) => void
  isRequesting: boolean
  onRetry: () => void
  onAbort: () => void
  selectedProviderKey: string | null
  onChangeProvider: (key: string | null) => void
}

export function ChatSessionView({
  xMessages,
  onRequest,
  isRequesting,
  onRetry,
  onAbort,
  selectedProviderKey,
  onChangeProvider,
}: ChatSessionViewProps) {
  const [inputValue, setInputValue] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { activeSession, isLoadingHistory, error, availableProviders, isInitLoading, initError, clearError } =
    useChatStore()

  const handleSubmit = useCallback(
    (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return
      const sid = activeSession?.id
      if (!sid) {
        setErrorMessage('会话尚未就绪，请稍候重试')
        return
      }
      setErrorMessage(null)
      setInputValue('')
      onRequest({
        response_mode: 'streaming',
        query: trimmed,
        conversation_id: sid,
        provider_key: selectedProviderKey ?? undefined,
      })
    },
    [activeSession?.id, selectedProviderKey, onRequest]
  )

  const bubbleItems = xMessages.map(({ id, message, status }) => ({
    key: id,
    role: message.role,
    content: message.content,
    loading: status === 'loading',
    contentRender:
      message.role === 'assistant'
        ? (content: string) => (
            <XMarkdown
              content={content}
              streaming={{
                hasNextChunk: status === 'loading' || status === 'updating',
              }}
            />
          )
        : undefined,
  }))

  // 错误自动清除
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => clearError(), 5000)
    return () => clearTimeout(timer)
  }, [error, clearError])

  return (
    <div className="relative flex h-full flex-col bg-white">
      {/* 消息区 — 占满上方空间 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-4 py-8">
          {isLoadingHistory && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}

          {!isLoadingHistory && xMessages.length === 0 && (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <h3 className="text-lg font-medium text-text-primary">开始新对话</h3>
                <p className="mt-2 text-sm text-text-secondary">在下方输入消息，开始与 AI 对话</p>
              </div>
            </div>
          )}

          <Bubble.List
            autoScroll
            role={{
              user: {
                placement: 'end',
                variant: 'filled',
                shape: 'round',
              },
              assistant: {
                placement: 'start',
                variant: 'borderless',
                shape: 'round',
              },
            }}
            items={bubbleItems}
            styles={{
              content: {
                fontSize: 14,
                lineHeight: 1.6,
              },
            }}
          />

          {errorMessage && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4" data-testid="error-banner">
              <p className="text-sm text-destructive-foreground">{errorMessage}</p>
              <Button data-testid="error-retry-btn" variant="destructive" size="sm" onClick={onRetry} className="mt-2">
                重试
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 底部悬浮输入区 — Sender 自带边框，无需外层 card */}
      <div className="flex justify-center px-4 pb-6 pt-2">
        <Sender
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          onCancel={onAbort}
          loading={isRequesting}
          placeholder="继续追问，或让 AI 生成需求条目..."
          submitType="enter"
          autoSize={{ minRows: 3, maxRows: 6 }}
          footer={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-[34px] w-[34px] rounded-xl bg-surface-2 text-text-secondary hover:bg-surface-3"
                  title="添加附件"
                  onClick={() => {}}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <ProviderSelector
                  providers={availableProviders}
                  selectedKey={selectedProviderKey}
                  onChange={onChangeProvider}
                  disabled={isRequesting || isInitLoading}
                />
                {initError && !isInitLoading && (
                  <button
                    type="button"
                    data-testid="init-retry-btn"
                    onClick={() => fetchProviders()}
                    className="text-xs text-brand-primary hover:underline"
                  >
                    模型列表加载失败，点击重试
                  </button>
                )}
              </div>
            </div>
          }
          suffix={(_, { components }) => {
            const { SendButton, LoadingButton } = components
            return isRequesting ? (
              <LoadingButton type="default" />
            ) : (
              <SendButton
                type="primary"
                disabled={!inputValue.trim()}
                style={{
                  borderRadius: 8,
                  width: 38,
                  height: 38,
                  minWidth: 38,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            )
          }}
          styles={{
            input: {
              fontSize: 15,
              color: 'var(--text-primary)',
            },
          }}
          className="w-full max-w-[780px] rounded-xl shadow-[0_16px_38px_rgba(0,0,0,0.08)]"
        />
      </div>

      {/* 错误 toast */}
      {error && (
        <div className="absolute bottom-28 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-error/20 bg-surface-1 px-4 py-2.5 text-sm text-error shadow-xl">
          <AlertCircleIcon className="size-4" />
          <span>{error}</span>
          <Button data-testid="error-toast-close" variant="ghost" size="icon-xs" onClick={clearError}>
            <XIcon className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
