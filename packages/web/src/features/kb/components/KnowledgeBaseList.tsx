import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, RefreshCw, BookOpen, Search, PanelLeftClose } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useKbStore } from '../store'
import { openDialog } from '@/overlays/services/overlay-service'
import type { KbEntry } from '@goferbot/data'

function KbSkeletonCard() {
  return (
    <div className="rounded-lg border border-border-subtle p-4">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-full" />
      <Skeleton className="mt-1 h-3 w-1/2" />
    </div>
  )
}

interface KnowledgeBaseListProps {
  sidebarOpen: boolean
  onToggle: () => void
  loadError: string | null
  onRetry: () => void
}

export function KnowledgeBaseList({ sidebarOpen, onToggle, loadError, onRetry }: KnowledgeBaseListProps) {
  const { entries, isLoading: kbLoading, selectedId, setSelectedId } = useKbStore()

  const handleCreate = useCallback(async () => {
    const CreateKbDialog = (await import('@/overlays/dialogs/CreateKbDialog')).default
    await openDialog(CreateKbDialog, {
      onConfirm: () => {
        // 创建成功后刷新列表 — 由 Service 层处理
      },
    })
  }, [])

  const handleSelect = useCallback((entry: KbEntry) => {
    setSelectedId(entry.id)
  }, [setSelectedId])

  return (
    <div
      className={cn(
        'flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out',
        sidebarOpen ? 'w-[286px]' : 'w-0',
      )}
    >
      <aside className="flex h-full w-[286px] flex-col border-r border-[#E7EAF0] bg-[#fcfcfd]">
        <div className="flex items-center justify-between px-5 pt-6 pb-3">
          <h2 className="text-lg font-semibold text-[#1F2328]">知识库</h2>
          <div className="flex items-center gap-1">
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E7EAF0] bg-white transition-colors hover:bg-[#F7F8FA]"
              onClick={handleCreate}
            >
              <Plus className="h-4 w-4 text-[#5E6673]" />
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#9AA3AF] transition-colors hover:bg-[#F7F8FA] hover:text-[#5E6673]"
              onClick={onToggle}
              title="收起知识库列表"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mx-5 mb-4">
          <div className="flex items-center gap-2 rounded-lg bg-[#F7F8FA] px-3 py-2.5">
            <Search className="h-4 w-4 text-[#9AA3AF]" />
            <input
              type="text"
              placeholder="搜索知识库"
              className="flex-1 bg-transparent text-sm text-[#1F2328] outline-none placeholder:text-[#9AA3AF]"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-auto px-5 pb-4">
          {kbLoading ? (
            <div className="space-y-2">
              <KbSkeletonCard />
              <KbSkeletonCard />
              <KbSkeletonCard />
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <p className="text-xs text-destructive">{loadError}</p>
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="mr-1 h-3 w-3" />
                重试
              </Button>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <BookOpen className="h-8 w-8 text-text-tertiary" />
              <p className="text-xs text-text-secondary">暂无知识库</p>
              <Button variant="outline" size="sm" onClick={handleCreate}>
                <Plus className="mr-1 h-3 w-3" />
                创建
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    'group flex cursor-pointer flex-col gap-2 rounded-xl p-3.5 transition-colors',
                    selectedId === entry.id
                      ? 'bg-[#EEF2FF]'
                      : 'border border-[#E7EAF0] bg-white hover:bg-[#F7F8FA]',
                  )}
                  onClick={() => handleSelect(entry)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen
                        className={cn(
                          'h-4 w-4',
                          selectedId === entry.id ? 'text-[#5B7CFA]' : 'text-[#9AA3AF]',
                        )}
                      />
                      <span
                        className={cn(
                          'text-sm font-medium',
                          selectedId === entry.id ? 'text-[#5B7CFA]' : 'text-[#1F2328]',
                        )}
                      >
                        {entry.name}
                      </span>
                    </div>
                    <button
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[#9AA3AF] opacity-0 transition-opacity hover:bg-[#F7F8FA] group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="19" cy="12" r="1" />
                        <circle cx="5" cy="12" r="1" />
                      </svg>
                    </button>
                  </div>
                  <span
                    className={cn(
                      'text-xs',
                      selectedId === entry.id ? 'text-[#5B7CFA]/80' : 'text-[#9AA3AF]',
                    )}
                  >
                    {entry.description || `${entry.fileCount} 个文件`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </nav>
      </aside>
    </div>
  )
}
