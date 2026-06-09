import { FolderIcon } from 'lucide-react'
import type { Folder, DocumentItem } from '@/stores/file'
import { FileGridItem } from './FileGridItem'
import { FileListItem } from './FileListItem'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface FileManagerProps {
  folders: Folder[]
  documents: DocumentItem[]
  isLoading: boolean
  error: string | null
  viewMode: 'grid' | 'list'
  sortBy: string
  sortOrder: 'asc' | 'desc'
  filterType: string
  onFolderClick: (folder: Folder) => void
  onDocumentClick: (doc: DocumentItem) => void
  onRetry: () => void
  onViewModeChange: (mode: 'grid' | 'list') => void
  onSortChange: (sort: string) => void
  onFilterChange: (filter: string) => void
}

export function FileManager({
  folders,
  documents,
  isLoading,
  error,
  viewMode,
  sortBy: _sortBy,
  sortOrder,
  filterType: _filterType,
  onFolderClick,
  onDocumentClick,
  onRetry,
  onViewModeChange: _onViewModeChange,
  onSortChange: _onSortChange,
  onFilterChange: _onFilterChange,
}: FileManagerProps) {
  // Sort items by name
  const sortedFolders = [...folders].sort((a, b) => {
    const aName = a.name.toLowerCase()
    const bName = b.name.toLowerCase()
    return sortOrder === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName)
  })

  const sortedDocuments = [...documents].sort((a, b) => {
    const aName = a.name.toLowerCase()
    const bName = b.name.toLowerCase()
    return sortOrder === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName)
  })

  // Filter documents by type
  const filteredDocuments = sortedDocuments.filter((doc) => {
    if (_filterType === 'all') return true
    if (_filterType === 'image') return doc.mimeType?.startsWith('image/')
    if (_filterType === 'document') {
      return doc.mimeType === 'application/pdf' ||
        doc.mimeType === 'application/msword' ||
        doc.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }
    if (_filterType === 'spreadsheet') {
      return doc.mimeType === 'application/vnd.ms-excel' ||
        doc.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
    return true
  })

  if (isLoading) {
    return (
      <div>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              data-testid="skeleton-card"
              className="h-32 bg-[#F7F8FA] rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <div className="bg-error/10 border border-error rounded-lg p-4">
          <p className="text-error text-sm">{error}</p>
          <Button variant="destructive" size="sm" onClick={onRetry} className="mt-2">
            重试
          </Button>
        </div>
      </div>
    )
  }

  const hasItems = sortedFolders.length > 0 || filteredDocuments.length > 0

  if (!hasItems) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px]">
        <FolderIcon className="h-12 w-12 text-text-tertiary mb-2" />
        <p className="text-text-secondary text-sm">暂无文件</p>
      </div>
    )
  }

  const totalCount = sortedFolders.length + filteredDocuments.length

  if (viewMode === 'grid') {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-3">
          {sortedFolders.map((folder) => (
            <FileGridItem
              key={folder.id}
              item={folder}
              isFolder
              onClick={() => onFolderClick(folder)}
            />
          ))}
          {filteredDocuments.map((doc) => (
            <FileGridItem
              key={doc.id}
              item={doc}
              isFolder={false}
              onClick={() => onDocumentClick(doc)}
            />
          ))}
        </div>
        <div className="flex justify-center py-2 text-sm text-[#9AA3AF]">
          共 {totalCount} 项
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>名称</TableHead>
            <TableHead>类型</TableHead>
            <TableHead className="text-right">大小</TableHead>
            <TableHead className="text-right">日期</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFolders.map((folder) => (
            <FileListItem
              key={folder.id}
              item={folder}
              isFolder
              onClick={() => onFolderClick(folder)}
            />
          ))}
          {filteredDocuments.map((doc) => (
            <FileListItem
              key={doc.id}
              item={doc}
              isFolder={false}
              onClick={() => onDocumentClick(doc)}
            />
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-center py-2 text-sm text-[#9AA3AF]">
        共 {totalCount} 项
      </div>
    </div>
  )
}
