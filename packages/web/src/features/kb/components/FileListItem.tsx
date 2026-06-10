import { FolderIcon } from 'lucide-react'
import { getFileIcon, formatFileSize, formatDate } from '@/utils/file'
import type { Folder, DocumentItem } from '../types'

interface FileListItemProps {
  item: Folder | DocumentItem
  isFolder: boolean
  onClick: () => void
}

export function FileListItem({ item, isFolder, onClick }: FileListItemProps) {
  const Icon = isFolder ? FolderIcon : getFileIcon((item as DocumentItem).ext ?? null)
  const doc = item as DocumentItem
  const size = isFolder ? null : doc.size
  const date = 'createdAt' in item ? item.createdAt : ''
  const ext = isFolder ? null : doc.ext

  return (
    <tr
      onClick={onClick}
      className="border-b border-border-default hover:bg-surface-2 cursor-pointer transition-colors"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
    >
      <td className="py-2 px-3">
        <Icon className="h-5 w-5 text-text-secondary" />
      </td>
      <td className="py-2 px-3 text-sm text-text-primary">{item.name}</td>
      <td className="py-2 px-3 text-xs text-text-tertiary">
        {isFolder ? '文件夹' : (ext ?? '--')}
      </td>
      <td className="py-2 px-3 text-xs text-text-tertiary text-right">
        {size !== null ? formatFileSize(size) : '--'}
      </td>
      <td className="py-2 px-3 text-xs text-text-tertiary text-right">
        {date ? formatDate(date) : '--'}
      </td>
    </tr>
  )
}
