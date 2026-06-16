import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus,
  RefreshCw,
  BookOpen,
  Search,
  PanelLeftClose,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  MoreHorizontal,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/utils/cn'
import { useKbStore } from '../store'
import {
  fetchKbList,
  pinKnowledgeBase,
  removeKnowledgeBaseAndClearSelection,
} from '../services'
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

interface KbListItemProps {
  entry: KbEntry
  isSelected: boolean
  onSelect: (entry: KbEntry) => void
  onPin: (entry: KbEntry) => void
  onRename: (entry: KbEntry) => void
  onDelete: (entry: KbEntry) => void
}

function KbListItem({ entry, isSelected, onSelect, onPin, onRename, onDelete }: KbListItemProps) {
  const handleSelect = useCallback(() => onSelect(entry), [entry, onSelect])

  return (
    <div
      className={cn(
        'group flex cursor-pointer flex-col gap-2 rounded-xl p-3.5 transition-colors',
        isSelected ? 'bg-[#EEF2FF]' : 'border border-[#E7EAF0] bg-white hover:bg-[#F7F8FA]',
      )}
      onClick={handleSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {entry.isPinned && (
            <Pin className="h-3 w-3 fill-[#5B7CFA] text-[#5B7CFA]" aria-hidden="true" />
          )}
          <BookOpen
            className={cn(
              'h-4 w-4',
              isSelected ? 'text-[#5B7CFA]' : 'text-[#9AA3AF]',
            )}
          />
          <span
            className={cn(
              'text-sm font-medium',
              isSelected ? 'text-[#5B7CFA]' : 'text-[#1F2328]',
            )}
          >
            {entry.name}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-md text-[#9AA3AF] transition-opacity hover:bg-[#F7F8FA]',
                isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              )}
              onClick={(e) => e.stopPropagation()}
              aria-label="知识库操作"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onPin(entry)
              }}
            >
              {entry.isPinned ? (
                <PinOff className="mr-2 h-4 w-4" />
              ) : (
                <Pin className="mr-2 h-4 w-4" />
              )}
              {entry.isPinned ? '取消置顶' : '置顶'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onRename(entry)
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              重命名
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(entry)
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <span
        className={cn(
          'text-xs',
          isSelected ? 'text-[#5B7CFA]/80' : 'text-[#9AA3AF]',
        )}
      >
        {entry.description || `${entry.fileCount ?? 0} 个文件`}
      </span>
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
      onConfirm: async () => {
        await fetchKbList()
      },
    })
  }, [])

  const handleSelect = useCallback((entry: KbEntry) => {
    setSelectedId(entry.id)
  }, [setSelectedId])

  const handlePin = useCallback(async (entry: KbEntry) => {
    await pinKnowledgeBase(entry.id, !entry.isPinned)
  }, [])

  const handleRename = useCallback(async (entry: KbEntry) => {
    const EditKbDialog = (await import('@/overlays/dialogs/EditKbDialog')).default
    await openDialog(EditKbDialog, {
      entry,
      onConfirm: async () => {
        await fetchKbList()
      },
    })
  }, [])

  const handleDelete = useCallback(async (entry: KbEntry) => {
    const DeleteKbDialog = (await import('@/overlays/dialogs/DeleteKbDialog')).default
    await openDialog(DeleteKbDialog, {
      kbId: entry.id,
      kbName: entry.name,
      onConfirm: async () => {
        removeKnowledgeBaseAndClearSelection(entry.id)
        await fetchKbList()
      },
    })
  }, [])

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
              aria-label="搜索知识库"
              maxLength={100}
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
                <KbListItem
                  key={entry.id}
                  entry={entry}
                  isSelected={selectedId === entry.id}
                  onSelect={handleSelect}
                  onPin={handlePin}
                  onRename={handleRename}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </nav>
      </aside>
    </div>
  )
}
