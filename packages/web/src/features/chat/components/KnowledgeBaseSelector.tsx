import { useRequest } from 'alova/client'
import { getKbList } from '@/api/KnowledgeBase'
import type { KbEntry } from '@goferbot/data'
import { DatabaseIcon, HashIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/utils/cn'

interface KnowledgeBaseSelectorProps {
  selectedIds: string[]
  onToggle: (kbId: string) => void
  disabled?: boolean
}

export function KnowledgeBaseSelector({ selectedIds, onToggle, disabled = false }: KnowledgeBaseSelectorProps) {
  const { data, loading, error, send } = useRequest(() => getKbList(), { immediate: true })

  const rawData = data as any
  const kbList: KbEntry[] = Array.isArray(rawData) ? rawData : (rawData?.data ?? [])

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
          {selectedIds.length > 0 && (
            <span className="ml-0.5 rounded-full bg-brand-primary px-1.5 py-px text-[10px] text-white">
              {selectedIds.length}
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
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 w-full animate-pulse rounded bg-surface-2" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="space-y-2 p-4 text-center text-sm">
            <p className="text-text-secondary">{error.message ?? '加载失败'}</p>
            <button
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
          kbList.map(kb => (
            <div
              key={kb.id}
              data-testid="kb-selector-item"
              className={cn(
                'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl',
                'text-text-primary hover:bg-surface-2'
              )}
              onClick={e => {
                e.preventDefault()
                onToggle(kb.id)
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(kb.id)}
                className="pointer-events-none size-4 rounded border-border-default text-brand-primary focus:ring-brand-primary"
                readOnly
              />
              <DatabaseIcon className="size-4 text-text-secondary" />
              <span className="truncate">{kb.name}</span>
              <span className="ml-auto text-xs text-text-tertiary">{kb.fileCount ?? 0} 文档</span>
            </div>
          ))}
      </PopoverContent>
    </Popover>
  )
}
