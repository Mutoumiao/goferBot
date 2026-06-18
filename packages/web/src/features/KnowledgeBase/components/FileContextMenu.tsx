import { Copy, FolderInput, FolderOpen, FolderPlus, Pencil, Trash2 } from 'lucide-react'
import { useCallback } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { DocumentItem, Folder } from '../types'

interface FileContextMenuProps {
  item: Folder | DocumentItem | null
  children: React.ReactNode
  onOpen?: (item: Folder | DocumentItem) => void
  onRename?: (item: Folder | DocumentItem) => void
  onDelete?: (item: Folder | DocumentItem) => void
  onMove?: (item: Folder | DocumentItem) => void
  onCopy?: (item: Folder | DocumentItem) => void
  onCreateFolder?: () => void
}

export function FileContextMenu({
  item,
  children,
  onOpen,
  onRename,
  onDelete,
  onMove,
  onCopy,
  onCreateFolder,
}: FileContextMenuProps) {
  const handleOpen = useCallback(() => {
    if (item && onOpen) onOpen(item)
  }, [item, onOpen])

  const handleRename = useCallback(() => {
    if (item && onRename) onRename(item)
  }, [item, onRename])

  const handleDelete = useCallback(() => {
    if (item && onDelete) onDelete(item)
  }, [item, onDelete])

  const handleMove = useCallback(() => {
    if (item && onMove) onMove(item)
  }, [item, onMove])

  const handleCopy = useCallback(() => {
    if (item && onCopy) onCopy(item)
  }, [item, onCopy])

  const isFolder = item ? !('status' in item) : false

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {item ? (
          <>
            {isFolder && onOpen && (
              <ContextMenuItem onClick={handleOpen}>
                <FolderOpen className="mr-2 h-4 w-4" />
                打开
              </ContextMenuItem>
            )}
            {onRename && (
              <ContextMenuItem onClick={handleRename}>
                <Pencil className="mr-2 h-4 w-4" />
                重命名
              </ContextMenuItem>
            )}
            {onMove && (
              <ContextMenuItem onClick={handleMove}>
                <FolderInput className="mr-2 h-4 w-4" />
                移动到
              </ContextMenuItem>
            )}
            {onCopy && (
              <ContextMenuItem onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" />
                复制到
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            {onDelete && (
              <ContextMenuItem onClick={handleDelete} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </ContextMenuItem>
            )}
          </>
        ) : (
          <>
            {onCreateFolder && (
              <ContextMenuItem onClick={onCreateFolder}>
                <FolderPlus className="mr-2 h-4 w-4" />
                新建文件夹
              </ContextMenuItem>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
