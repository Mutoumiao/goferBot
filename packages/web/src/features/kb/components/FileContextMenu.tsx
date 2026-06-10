import { useCallback } from 'react'
import {
  FolderOpen,
  Pencil,
  Trash2,
  FolderPlus,
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { Folder, DocumentItem } from '../types'

interface FileContextMenuProps {
  item: Folder | DocumentItem | null
  children: React.ReactNode
  onOpen?: (item: Folder | DocumentItem) => void
  onRename?: (item: Folder | DocumentItem) => void
  onDelete?: (item: Folder | DocumentItem) => void
  onCreateFolder?: () => void
}

export function FileContextMenu({
  item,
  children,
  onOpen,
  onRename,
  onDelete,
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

  const isFolder = item ? !('status' in item) : false

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
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
