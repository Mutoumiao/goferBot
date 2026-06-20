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

/**
 * 包装菜单项点击回调，确保 ContextMenu 彻底释放焦点后再执行业务逻辑。
 *
 * 当前 overlay 系统把 Dialog 渲染到 document.body 的 portal 中。Dialog 挂载时会
 * 立即给页面其余部分加 aria-hidden。如果此时 ContextMenu 的菜单项或触发器仍持有
 * 焦点，浏览器就会报 "Blocked aria-hidden on an element because its descendant
 * retained focus"。
 *
 * 因此先 blur 当前焦点元素，再用 setTimeout 让菜单完成关闭动画，最后才打开 Dialog。
 */
function deferAfterClose(handler: () => void) {
  return () => {
    const active = document.activeElement as HTMLElement | null
    active?.blur()
    window.setTimeout(() => handler(), 0)
  }
}

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
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48" onCloseAutoFocus={(e) => e.preventDefault()}>
        {item ? (
          <>
            {isFolder && onOpen && (
              <ContextMenuItem onClick={deferAfterClose(handleOpen)}>
                <FolderOpen className="mr-2 h-4 w-4" />
                打开
              </ContextMenuItem>
            )}
            {onRename && (
              <ContextMenuItem onClick={deferAfterClose(handleRename)}>
                <Pencil className="mr-2 h-4 w-4" />
                重命名
              </ContextMenuItem>
            )}
            {onMove && (
              <ContextMenuItem onClick={deferAfterClose(handleMove)}>
                <FolderInput className="mr-2 h-4 w-4" />
                移动到
              </ContextMenuItem>
            )}
            {onCopy && (
              <ContextMenuItem onClick={deferAfterClose(handleCopy)}>
                <Copy className="mr-2 h-4 w-4" />
                复制到
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            {onDelete && (
              <ContextMenuItem onClick={deferAfterClose(handleDelete)} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </ContextMenuItem>
            )}
          </>
        ) : (
          onCreateFolder && (
            <ContextMenuItem onClick={deferAfterClose(onCreateFolder)}>
              <FolderPlus className="mr-2 h-4 w-4" />
              新建文件夹
            </ContextMenuItem>
          )
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
