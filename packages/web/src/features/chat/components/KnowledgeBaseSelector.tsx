import type { KbSelectorEntry } from '@goferbot/data'
import { useRequest } from 'alova/client'
import { DatabaseIcon, HashIcon } from 'lucide-react'
import { getKbForSelector } from '@/api/KnowledgeBase'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/utils/cn'

interface KnowledgeBaseSelectorProps {
  selectedId: string | null
  onSelect: (kbId: string | null) => void
  disabled?: boolean
}

export function KnowledgeBaseSelector({
  selectedId,
  onSelect,
  disabled = false,
}: KnowledgeBaseSelectorProps) {
  const { data, loading, error, send } = useRequest(() => getKbForSelector(), { immediate: true })

  const kbList: KbSelectorEntry[] = Array.isArray(data) ? data : []

  const handleToggle = (kbId: string) => {
    onSelect(selectedId === kbId ? null : kbId)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="kb-selector-trigger"
          disabled={disabled}
          className="inline-flex h-auto items-center gap-1 rounded px-2 py-0.5 text-xs text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <HashIcon className="size-3.5" />
          <span>知识库</span>
          {selectedId && (
            <span className="ml-0.5 rounded-full bg-brand-primary px-1.5 py-px text-[10px] text-white">
              1
            </span>
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

        {!loading &&
          !error &&
          kbList.map((kb) => {
            const isSelected = selectedId === kb.id
            return (
              <button
                key={kb.id}
                type="button"
                data-testid="kb-selector-item"
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl border-none bg-transparent text-left',
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
