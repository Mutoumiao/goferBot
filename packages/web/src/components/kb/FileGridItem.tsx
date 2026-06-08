import { FolderIcon } from 'lucide-react'
import type { Folder, DocumentItem } from '@/stores/file'
import { getFileIcon, formatFileSize, formatDate } from '@/utils/file'

interface FileGridItemProps {
  item: Folder | DocumentItem
  isFolder: boolean
  onClick: () => void
}

export function FileGridItem({ item, isFolder, onClick }: FileGridItemProps) {
  const Icon = isFolder ? FolderIcon : getFileIcon((item as DocumentItem).ext ?? null)
  const size = isFolder ? null : (item as DocumentItem).size
  const date = 'createdAt' in item ? item.createdAt : ''

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-lg border border-border-default bg-surface-1 p-4 hover:shadow-sm transition-shadow cursor-pointer text-left w-full"
    >
      <Icon data-testid={isFolder ? 'folder-icon' : 'file-icon'} className="h-10 w-10 text-text-secondary" />
      <span className="text-sm font-medium text-text-primary truncate w-full text-center" title={item.name}>
        {item.name}
      </span>
      {!isFolder && (
        <div className="flex gap-2 text-xs text-text-tertiary">
          <span>{formatFileSize(size)}</span>
          <span data-testid="item-date">{formatDate(date)}</span>
        </div>
      )}
      {!isFolder && <span data-testid="item-size" className="hidden">{formatFileSize(size)}</span>}
    </button>
  )
}
