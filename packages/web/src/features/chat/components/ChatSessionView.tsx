import { Bubble } from '@ant-design/x'
import { XMarkdown } from '@ant-design/x-markdown'
import type { ChatSourceItem } from '@goferbot/data'
import { AlertCircleIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { GoferInput, GoferMessage } from '../providers/GoferChatProvider'
import { fetchProviders } from '../services'
import { useChatStore } from '../store'
import { ChatComposer } from './ChatComposer'
import { SourceCitations, SourceDocsFloatingPanel } from './SourceCitations'

function retryFetchProviders() {
  void fetchProviders({ force: true })
}

interface ChatSessionViewProps {
  conversationId: string
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
  selectedKbIds: string[]
  onChangeKbIds: (ids: string[]) => void
}

export function ChatSessionView({
  conversationId,
  xMessages,
  onRequest,
  isRequesting,
  onRetry,
  onAbort,
  selectedProviderKey,
  onChangeProvider,
  selectedKbIds,
  onChangeKbIds,
}: ChatSessionViewProps) {
  const [inputValue, setInputValue] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  /** 右上角参考文档浮层（按消息点击展开） */
  const [panelSources, setPanelSources] = useState<ChatSourceItem[] | null>(null)

  // 细粒度订阅，避免 loadHistory / setActiveSession 等无关字段触发整页重渲染
  const isLoadingHistory = useChatStore((s) => s.isLoadingHistory)
  const error = useChatStore((s) => s.error)
  const availableProviders = useChatStore((s) => s.availableProviders)
  const isInitLoading = useChatStore((s) => s.isInitLoading)
  const initError = useChatStore((s) => s.initError)
  const clearError = useChatStore((s) => s.clearError)

  const handleSubmit = useCallback(
    (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return
      if (selectedKbIds.length === 0) {
        setErrorMessage('请先选择至少一个知识库')
        return
      }
      setErrorMessage(null)
      setInputValue('')
      onRequest({
        response_mode: 'streaming',
        query: trimmed,
        conversation_id: conversationId || '',
        provider_key: selectedProviderKey ?? undefined,
        knowledge_base_ids: selectedKbIds,
        retrieval_mode: 'strict',
      })
    },
    [conversationId, selectedProviderKey, selectedKbIds, onRequest],
  )

  function handleOpenSources(sources: ChatSourceItem[]) {
    setPanelSources(sources)
  }

  const bubbleItems = xMessages.map(({ id, message, status }) => ({
    key: id,
    role: message.role,
    content: message.content,
    loading: status === 'loading',
    contentRender:
      message.role === 'assistant'
        ? (content: string) => (
            <div>
              <SourceCitations
                sources={message.sources}
                retrievalEmpty={message.retrieval_empty}
                onOpenPanel={handleOpenSources}
              />
              <XMarkdown
                content={content}
                streaming={{
                  hasNextChunk: status === 'loading' || status === 'updating',
                }}
              />
            </div>
          )
        : undefined,
  }))

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => clearError(), 5000)
    return () => clearTimeout(timer)
  }, [error, clearError])

  // 切换会话时关闭浮层
  useEffect(() => {
    setPanelSources(null)
  }, [conversationId])

  return (
    <div className="relative flex h-full flex-col bg-surface-1" data-testid="chat-session-view">
      {/* 右上角参考文档浮层 */}
      {panelSources && (
        <SourceDocsFloatingPanel sources={panelSources} onClose={() => setPanelSources(null)} />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
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
                <h3 className="text-lg font-medium text-text-primary">开始知识库问答</h3>
                <p className="mt-2 text-sm text-text-secondary">
                  请先选择知识库，再输入问题（强制绑定 KB）
                </p>
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
            <div
              className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4"
              data-testid="error-banner"
            >
              <p className="text-sm text-destructive-foreground">{errorMessage}</p>
              {errorMessage.includes('知识库') ? null : (
                <Button
                  data-testid="error-retry-btn"
                  variant="destructive"
                  size="sm"
                  onClick={onRetry}
                  className="mt-2"
                >
                  重试
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 底部统一输入胶囊（与首页 ChatEmptyHome 同一组件） */}
      <div className="flex justify-center px-4 pb-6 pt-2">
        <ChatComposer
          value={inputValue}
          onChange={(v) => {
            setInputValue(v)
            if (errorMessage) setErrorMessage(null)
          }}
          onSubmit={handleSubmit}
          onAbort={onAbort}
          loading={isRequesting}
          selectedKbIds={selectedKbIds}
          onChangeKbIds={onChangeKbIds}
          selectedProviderKey={selectedProviderKey}
          onChangeProvider={onChangeProvider}
          providers={availableProviders}
          isInitLoading={isInitLoading}
          initError={initError}
          onRetryProviders={retryFetchProviders}
          error={errorMessage}
          showDisclaimer
          placeholder={
            selectedKbIds.length === 0
              ? '请先选择知识库，再输入问题…'
              : '继续提问…'
          }
          sendTestId="session-send-btn"
        />
      </div>

      {error && (
        <div className="absolute bottom-28 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-error/20 bg-surface-1 px-4 py-2.5 text-sm text-error shadow-xl">
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
  )
}
