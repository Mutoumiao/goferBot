import { FolderIcon } from 'lucide-react'
import type { Folder, DocumentItem } from '@/stores/file'
import { formatFileSize } from '@/utils/file'
import { cn } from '@/utils/cn'

interface FileGridItemProps {
  item: Folder | DocumentItem
  isFolder: boolean
  onClick: () => void
}

const FOLDER_ICON_COLORS: Record<string, { bg: string; icon: string }> = {
  docs: { bg: 'bg-[#E8F5E9]', icon: 'text-[#4CAF50]' },
  调研原始资料: { bg: 'bg-[#E3F2FD]', icon: 'text-[#2196F3]' },
  会议纪要: { bg: 'bg-[#FFF3E0]', icon: 'text-[#FF9800]' },
  竞品分析: { bg: 'bg-[#F3E5F5]', icon: 'text-[#9C27B0]' },
}

const FILE_TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pdf: { bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]', label: 'PDF' },
  xlsx: { bg: 'bg-[#DCFCE7]', text: 'text-[#16A34A]', label: 'XLSX' },
  pptx: { bg: 'bg-[#FEF3C7]', text: 'text-[#D97706]', label: 'PPTX' },
  md: { bg: 'bg-[#F1F3F6]', text: 'text-[#5E6673]', label: 'MD' },
}

const FILE_ICON_BG: Record<string, string> = {
  pdf: 'bg-[#F44336]',
  xlsx: 'bg-[#4CAF50]',
  pptx: 'bg-[#FFC107]',
  md: 'bg-[#9E9E9E]',
}

function FolderCard({ item, onClick }: { item: Folder; onClick: () => void }) {
  const colors = FOLDER_ICON_COLORS[item.name] || { bg: 'bg-[#E3F2FD]', icon: 'text-[#2196F3]' }
  const date = new Date(item.updatedAt)
  const dateStr = `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer flex-col gap-2.5 rounded-xl border border-[#E7EAF0] bg-white p-3.5 transition-colors hover:bg-[#F7F8FA]"
    >
      <div className="flex items-center justify-between">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-[10px]', colors.bg)}>
          <FolderIcon className={cn('h-6 w-6', colors.icon)} />
        </div>
        <button
          className="flex h-6 w-6 items-center justify-center rounded-md text-[#9AA3AF] transition-colors hover:bg-[#F7F8FA]"
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-[#1F2328]">{item.name}</span>
        <span className="text-xs text-[#9AA3AF]">7 个文件</span>
        <span className="text-xs text-[#9AA3AF]">{dateStr}</span>
      </div>
    </div>
  )
}

function DocumentCard({ item, onClick }: { item: DocumentItem; onClick: () => void }) {
  const ext = item.ext ?? ''
  const typeColors = FILE_TYPE_COLORS[ext] || { bg: 'bg-[#F1F3F6]', text: 'text-[#5E6673]', label: ext.toUpperCase() }
  const iconBg = FILE_ICON_BG[ext] || 'bg-[#9E9E9E]'
  const date = new Date(item.updatedAt)
  const dateStr = `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  const firstLetter = item.name.charAt(0).toUpperCase()

  return (
    <div
      onClick={onClick}
      className="flex h-[150px] cursor-pointer flex-col gap-2.5 rounded-xl border border-[#E7EAF0] bg-white p-3.5 transition-colors hover:bg-[#F7F8FA]"
    >
      <div className="flex items-center justify-between">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-[10px]', iconBg)}>
          <span className="text-base font-bold text-white">{firstLetter}</span>
        </div>
        <button
          className="flex h-6 w-6 items-center justify-center rounded-md text-[#9AA3AF] transition-colors hover:bg-[#F7F8FA]"
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#1F2328]">{item.name}</span>
        </div>
        <span className={cn('w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold', typeColors.bg, typeColors.text)}>
          {typeColors.label}
        </span>
        <span className="text-xs text-[#9AA3AF]">{formatFileSize(item.size)}</span>
        <span className="text-xs text-[#9AA3AF]">{dateStr}</span>
      </div>
    </div>
  )
}

export function FileGridItem({ item, isFolder, onClick }: FileGridItemProps) {
  if (isFolder) {
    return <FolderCard item={item as Folder} onClick={onClick} />
  }
  return <DocumentCard item={item as DocumentItem} onClick={onClick} />
}
