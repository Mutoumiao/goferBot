import type { KbEntry } from '@goferbot/data'
import {
  BookOpen,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { openDialog } from '@/overlays/services/overlay-service'
import { cn } from '@/utils/cn'
import {
  fetchKbList,
  loadKbItems,
  pinKnowledgeBase,
  removeKnowledgeBaseAndClearSelection,
} from '../services'
import { useKbStore } from '../store'

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
    <li className="group relative flex flex-col gap-2 rounded-xl p-3.5">
      <button
        type="button"
        className={cn(
          'absolute inset-0 z-0 rounded-xl transition-all',
          isSelected
            ? 'bg-brand-blue-soft shadow-sm ring-1 ring-brand-blue/20'
            : 'border border-border-subtle bg-surface-1 hover:bg-surface-2',
        )}
        onClick={handleSelect}
        aria-pressed={isSelected}
        aria-label={`选择知识库 ${entry.name}`}
      />
      <div className="relative z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2">
          {entry.isPinned && (
            <Pin className="h-3 w-3 fill-brand-blue text-brand-blue" aria-hidden="true" />
          )}
          <BookOpen
            className={cn('h-4 w-4', isSelected ? 'text-brand-blue' : 'text-text-tertiary')}
          />
          <span
            className={cn(
              'text-sm font-medium',
              isSelected ? 'text-brand-blue' : 'text-text-primary',
            )}
          >
            {entry.name}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary transition-opacity hover:bg-surface-3',
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
          'relative z-10 text-xs pointer-events-none',
          isSelected ? 'text-brand-blue/80' : 'text-text-tertiary',
        )}
      >
        {entry.description || `${entry.fileCount ?? 0} 个文件`}
      </span>
    </li>
  )
}

interface KnowledgeBaseListProps {
  sidebarOpen: boolean
  onToggle: () => void
  loadError: string | null
  onRetry: () => void
}

export function KnowledgeBaseList({
  sidebarOpen,
  onToggle,
  loadError,
  onRetry,
}: KnowledgeBaseListProps) {
  const { entries, isLoading: kbLoading, selectedId, setSelectedId } = useKbStore()

  const handleCreate = useCallback(async () => {
    const CreateKbDialog = (await import('@/overlays/dialogs/CreateKbDialog')).default
    await openDialog(CreateKbDialog, {
      onConfirm: async () => {
        await fetchKbList()
      },
    })
  }, [])

  const handleSelect = useCallback(
    (entry: KbEntry) => {
      setSelectedId(entry.id)
      // 加载该知识库内容，同时设置 currentKbId —— 缺此调用会导致 currentKbId 永为 null，
      // 进而使 FileBrowser 上传按钮静默吞咽（点击上传选完文件后无任何反应）
      void loadKbItems(entry.id)
    },
    [setSelectedId],
  )

  const handlePin = useCallback(async (entry: KbEntry) => {
    await pinKnowledgeBase(entry.id, !entry.isPinned)
  }, [])

  const handleRename = useCallback(async (entry: KbEntry) => {
    const EditKbDialog = (await import('@/overlays/dialogs/EditKbDialog')).default
    await openDialog(EditKbDialog, {
      entry,
      onConfirm: async () => {
        try {
          await fetchKbList()
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '刷新知识库列表失败')
          throw e
        }
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
        try {
          await fetchKbList()
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '刷新知识库列表失败')
          throw e
        }
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
      <aside className="flex h-full w-[286px] flex-col border-r border-border-panel bg-surface-1">
        <div className="flex items-center justify-between border-b border-border-panel px-5 pb-3 pt-5">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-text-primary">知识库</h2>
            <p className="mt-0.5 text-[11px] text-text-tertiary">文档与同屏问答</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-default bg-surface-1 shadow-sm transition-colors hover:bg-surface-3"
              onClick={handleCreate}
              aria-label="新建知识库"
            >
              <Plus className="h-4 w-4 text-text-secondary" />
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-secondary"
              onClick={onToggle}
              title="收起知识库列表"
              aria-label="收起知识库列表"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mx-4 mb-3 mt-3">
          <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-1 px-3 py-2.5 shadow-sm">
            <Search className="h-4 w-4 text-text-tertiary" />
            <input
              id="kb-search"
              type="text"
              placeholder="搜索知识库"
              aria-label="搜索知识库"
              maxLength={100}
              className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-auto px-5 pb-4">
          {kbLoading && entries.length === 0 ? (
            <div className="space-y-2">
              <KbSkeletonCard />
              <KbSkeletonCard />
              <KbSkeletonCard />
            </div>
          ) : loadError && entries.length === 0 ? (
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
            <ul className="flex flex-col gap-2.5">
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
            </ul>
          )}
        </nav>
      </aside>
    </div>
  )
}
