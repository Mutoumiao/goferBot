import type { KbSelectorEntry } from '@goferbot/data'
import { useRequest } from 'alova/client'
import { ChevronDown, DatabaseIcon, HashIcon } from 'lucide-react'
import { getKbForSelector } from '@/api/KnowledgeBase'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/utils/cn'

interface KnowledgeBaseSelectorProps {
  /** Multi-select KB ids (Chat requires at least one). */
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  /** Visual hint that selection is required before send. */
  required?: boolean
  /** chip = 设计稿胶囊；ghost = 紧凑工具栏 */
  variant?: 'chip' | 'ghost'
}

export function KnowledgeBaseSelector({
  selectedIds,
  onChange,
  disabled = false,
  required = true,
  variant = 'ghost',
}: KnowledgeBaseSelectorProps) {
  const { data, loading, error, send } = useRequest(() => getKbForSelector(), { immediate: true })

  const kbList: KbSelectorEntry[] = Array.isArray(data) ? data : []
  const selectedSet = new Set(selectedIds)
  const selectedNames = kbList.filter((k) => selectedSet.has(k.id)).map((k) => k.name)

  const handleToggle = (kbId: string) => {
    if (selectedSet.has(kbId)) {
      onChange(selectedIds.filter((id) => id !== kbId))
    } else {
      onChange([...selectedIds, kbId])
    }
  }

  const count = selectedIds.length
  const missingRequired = required && count === 0
  const label =
    count === 0
      ? '知识库 · 默认'
      : count === 1
        ? `知识库 · ${selectedNames[0] ?? '默认'}`
        : `知识库 · ${count} 个`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="kb-selector-trigger"
          disabled={disabled}
          className={cn(
            'inline-flex h-auto items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            variant === 'chip'
              ? missingRequired
                ? 'border border-error/30 bg-error/5 text-error hover:bg-error/10'
                : 'border border-brand-blue/20 bg-brand-blue-soft text-brand-blue hover:bg-brand-blue-soft/80'
              : missingRequired
                ? 'text-error hover:bg-surface-2 hover:text-error'
                : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
          )}
        >
          {variant === 'chip' ? (
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                missingRequired ? 'bg-error' : 'bg-brand-blue',
              )}
              aria-hidden
            />
          ) : (
            <HashIcon className="size-3.5" />
          )}
          <span className="max-w-[140px] truncate">{label}</span>
          {variant === 'chip' ? (
            <ChevronDown className="size-3 opacity-70" />
          ) : count > 0 ? (
            <span className="ml-0.5 rounded-full bg-brand-primary px-1.5 py-px text-[10px] text-white">
              {count}
            </span>
          ) : (
            <span className="ml-0.5 text-[10px] text-error">必选</span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        className="w-72 rounded-xl border border-border-default bg-surface-1 p-0 shadow-xl"
        data-testid="kb-selector-dropdown"
      >
        {loading && (
          <div className="space-y-2 p-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 w-full animate-pulse rounded bg-surface-2" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="space-y-2 p-4 text-center text-sm">
            <p className="text-text-secondary">{error.message ?? '加载失败'}</p>
            <button
              type="button"
              data-testid="kb-selector-retry"
              className="text-brand-primary hover:underline"
              onClick={() => send()}
            >
              重试
            </button>
          </div>
        )}

        {!loading && !error && kbList.length === 0 && (
          <div className="p-4 text-center text-sm text-text-secondary">请先创建知识库</div>
        )}

        {!loading && !error && kbList.length > 0 && (
          <div className="border-b border-border-default px-3 py-2 text-[11px] text-text-tertiary">
            可多选；发送前至少选择一个
          </div>
        )}

        {!loading &&
          !error &&
          kbList.map((kb) => {
            const isSelected = selectedSet.has(kb.id)
            return (
              <button
                key={kb.id}
                type="button"
                data-testid="kb-selector-item"
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-2 text-left text-sm transition-colors first:rounded-t-xl last:rounded-b-xl',
                  isSelected
                    ? 'bg-surface-2 text-brand-primary'
                    : 'text-text-primary hover:bg-surface-2',
                )}
                onClick={(e) => {
                  e.preventDefault()
                  handleToggle(kb.id)
                }}
                aria-pressed={isSelected}
              >
                <DatabaseIcon className="size-4 text-text-secondary" />
                <span className="truncate">{kb.name}</span>
                <span className="ml-auto text-xs text-text-tertiary">{kb.fileCount ?? 0} 文档</span>
              </button>
            )
          })}
      </PopoverContent>
    </Popover>
  )
}
