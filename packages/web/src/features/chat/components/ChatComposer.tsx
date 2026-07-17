import type { ProviderListItem } from '@goferbot/data'
import { ArrowUp, Square } from 'lucide-react'
import { useEffect, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/utils/cn'
import { CHAT_INPUT_MAX_LENGTH } from '../constants'
import { fetchProviders } from '../services'
import { KnowledgeBaseSelector } from './KnowledgeBaseSelector'
import { ProviderSelector } from './ProviderSelector'

export interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (content: string) => void
  /** 流式生成中点击可中止 */
  onAbort?: () => void
  loading?: boolean
  disabled?: boolean
  placeholder?: string
  selectedKbIds: string[]
  onChangeKbIds: (ids: string[]) => void
  selectedProviderKey: string | null
  onChangeProvider: (key: string | null) => void
  providers: ProviderListItem[]
  isInitLoading?: boolean
  initError?: string | null
  onRetryProviders?: () => void
  /** 输入区局部错误（如未选 KB） */
  error?: string | null
  showDisclaimer?: boolean
  className?: string
  /** 外层 max 宽，默认 780 */
  maxWidthClassName?: string
  sendTestId?: string
  headerSlot?: ReactNode
}

/**
 * 统一会话输入胶囊：仅保留已实现能力（知识库 / 模型 / 文本输入 / 发送）。
 */
export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onAbort,
  loading = false,
  disabled = false,
  placeholder,
  selectedKbIds,
  onChangeKbIds,
  selectedProviderKey,
  onChangeProvider,
  providers,
  isInitLoading = false,
  initError = null,
  onRetryProviders,
  error = null,
  showDisclaimer = false,
  className,
  maxWidthClassName = 'max-w-[780px]',
  sendTestId = 'chat-send-btn',
  headerSlot,
}: ChatComposerProps) {
  const busy = loading || disabled
  const charCount = value.length
  const canSend =
    Boolean(value.trim()) && selectedKbIds.length > 0 && !busy && charCount <= CHAT_INPUT_MAX_LENGTH

  const resolvedPlaceholder =
    placeholder ??
    (selectedKbIds.length === 0
      ? '请先选择知识库，再提问…'
      : '输入问题，基于所选知识库回答…')

  // 进入输入区时若尚未加载模型列表则拉取（避免仅依赖页面级 silent-refresh 漏调）
  // 注意：空列表成功返回后不得 force 重试，否则会与 onRetryProviders 引用变化形成请求风暴
  useEffect(() => {
    if (providers.length > 0 || isInitLoading) return
    void fetchProviders()
  }, [providers.length, isInitLoading])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (loading) return
      const trimmed = value.trim()
      if (!trimmed || selectedKbIds.length === 0) return
      onSubmit(trimmed)
    }
  }

  const handleSendClick = () => {
    if (loading) {
      onAbort?.()
      return
    }
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
    <div className={cn('w-full', maxWidthClassName, className)} data-testid="chat-composer">
      {headerSlot}

      <div
        className={cn(
          'gofer-soft-shadow rounded-[24px] border border-border-subtle bg-surface-1 p-4',
          error && 'border-error/35',
        )}
      >
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <KnowledgeBaseSelector
            selectedIds={selectedKbIds}
            onChange={onChangeKbIds}
            disabled={busy}
            required
            variant="chip"
          />
          <ProviderSelector
            providers={providers}
            selectedKey={selectedProviderKey}
            onChange={(key) => onChangeProvider(key)}
            disabled={loading}
            loading={isInitLoading}
            onRetry={onRetryProviders ?? (() => void fetchProviders({ force: true }))}
            variant="chip"
          />
          {initError && !isInitLoading && (
            <button
              type="button"
              data-testid="init-retry-btn"
              onClick={() =>
                onRetryProviders ? onRetryProviders() : void fetchProviders({ force: true })
              }
              className="text-xs text-brand-blue hover:underline"
            >
              模型列表加载失败，点击重试
            </button>
          )}
        </div>

        <Textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value.slice(0, CHAT_INPUT_MAX_LENGTH))
          }}
          onKeyDown={handleKeyDown}
          maxLength={CHAT_INPUT_MAX_LENGTH}
          placeholder={resolvedPlaceholder}
          className="min-h-[80px] resize-none border-0 bg-transparent px-0.5 text-[15px] text-text-primary shadow-none placeholder:text-text-tertiary focus-visible:ring-0 focus-visible:ring-offset-0"
          disabled={busy && !loading}
          data-testid="chat-composer-input"
        />

        <div className="mt-2 flex items-center justify-end gap-2.5">
          <span
            className={cn(
              'text-[11px] tabular-nums text-text-tertiary',
              charCount > CHAT_INPUT_MAX_LENGTH * 0.9 && 'text-warning',
            )}
            data-testid="chat-composer-count"
          >
            {charCount} / {CHAT_INPUT_MAX_LENGTH}
          </span>
          <Button
            size="icon"
            className={cn(
              'h-9 w-9 shrink-0 rounded-full text-white shadow-[0_2px_8px_rgba(26,115,232,0.28)] hover:opacity-95 disabled:opacity-40',
              loading ? 'bg-text-primary' : 'gofer-brand-gradient',
            )}
            onClick={handleSendClick}
            disabled={loading ? !onAbort : !canSend}
            data-testid={sendTestId}
            aria-label={loading ? '停止生成' : '发送'}
          >
            {loading ? (
              <Square className="h-3.5 w-3.5 fill-white" />
            ) : (
              <ArrowUp className="h-4 w-4 stroke-[2.5]" />
            )}
          </Button>
        </div>

        {error && (
          <p className="mt-2 text-xs text-error" data-testid="chat-composer-error">
            {error}
          </p>
        )}
      </div>

      {showDisclaimer && (
        <p className="mt-3 text-center text-[11px] text-text-tertiary">
          回答可能不准确，请核对重要内容。
        </p>
      )}
    </div>
  )
}
