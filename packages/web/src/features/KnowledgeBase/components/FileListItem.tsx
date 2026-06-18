import { FolderIcon } from 'lucide-react'
import { formatDate, formatFileSize, getFileIcon } from '@/utils/file'
import type { DocumentItem, Folder } from '../types'

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
      className="relative border-b border-border-default hover:bg-surface-2 transition-colors focus-within:bg-[#EEF2FF] focus-within:ring-2 focus-within:ring-[#5B7CFA]"
    >
      <td colSpan={5} className="p-0">
        <button
          type="button"
          className="flex w-full items-center cursor-pointer bg-transparent border-none p-0 text-left focus-visible:outline-none"
          onClick={onClick}
          aria-label={isFolder ? `打开文件夹 ${item.name}` : `打开文档 ${item.name}`}
        >
          <span className="py-2 px-3">
            <Icon className="h-5 w-5 text-text-secondary" />
          </span>
          <span className="py-2 px-3 text-sm text-text-primary flex-1">{item.name}</span>
          <span className="py-2 px-3 text-xs text-text-tertiary">
            {isFolder ? '文件夹' : (ext ?? '--')}
          </span>
          <span className="py-2 px-3 text-xs text-text-tertiary text-right">
            {size !== null ? formatFileSize(size) : '--'}
          </span>
          <span className="py-2 px-3 text-xs text-text-tertiary text-right">
            {date ? formatDate(date) : '--'}
          </span>
        </button>
      </td>
    </tr>
  )
}
