import { useState, useRef, useEffect, useCallback } from 'react'
import { useRequest } from 'alova/client'
import { getKbList } from '@/api/kb'
import type { KbEntry } from '@goferbot/data'
import { DatabaseIcon, HashIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

interface KbSelectorProps {
  selectedIds: string[]
  onToggle: (kbId: string) => void
  disabled?: boolean
}

export function KbSelector({ selectedIds, onToggle, disabled = false }: KbSelectorProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data, loading, error, send } = useRequest(
    () => getKbList(),
    { immediate: false },
  )

  const rawData = (data as any)
  const kbList: KbEntry[] = Array.isArray(rawData) ? rawData : (rawData?.data ?? [])

  const handleOpen = useCallback(() => {
    if (disabled) return
    setOpen(true)
    if (!data && !loading) send()
  }, [disabled, data, loading, send])

  const handleClose = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        handleClose()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open, handleClose])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, handleClose])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="kb-selector-trigger"
        onClick={handleOpen}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs',
          'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <HashIcon className="size-3.5" />
        <span>知识库</span>
        {selectedIds.length > 0 && (
          <span className="ml-0.5 rounded-full bg-brand-primary px-1.5 py-px text-[10px] text-white">
            {selectedIds.length}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="kb-selector-dropdown"
          className="absolute bottom-full left-0 mb-2 max-h-48 w-72 overflow-y-auto rounded-xl border border-border-default bg-white shadow-xl"
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
                data-testid="kb-selector-retry"
                className="text-brand-primary hover:underline"
                onClick={() => send()}
              >
                重试
              </button>
            </div>
          )}

          {!loading && !error && kbList.length === 0 && (
            <div className="p-4 text-center text-sm text-text-secondary">
              请先创建知识库
            </div>
          )}

          {!loading && !error && kbList.map((kb) => (
            <div
              key={kb.id}
              data-testid="kb-selector-item"
              className={cn(
                'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors',
                'text-text-primary hover:bg-surface-2',
              )}
              onClick={(e) => {
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
              <span className="truncate">{kb.title}</span>
              <span className="ml-auto text-xs text-text-tertiary">
                {kb.fileCount ?? 0} 文档
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
