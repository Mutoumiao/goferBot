import { FolderIcon } from 'lucide-react'
import type { Folder, DocumentItem } from '@/stores/file'
import { FileGridItem } from './FileGridItem'
import { FileListItem } from './FileListItem'

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
  sortBy,
  sortOrder,
  filterType,
  onFolderClick,
  onDocumentClick,
  onRetry,
  onViewModeChange,
  onSortChange,
  onFilterChange,
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
    if (filterType === 'all') return true
    if (filterType === 'image') return doc.mimeType?.startsWith('image/')
    if (filterType === 'document') {
      return doc.mimeType === 'application/pdf' ||
        doc.mimeType === 'application/msword' ||
        doc.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }
    if (filterType === 'spreadsheet') {
      return doc.mimeType === 'application/vnd.ms-excel' ||
        doc.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
    return true
  })

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              data-testid="skeleton-card"
              className="h-32 bg-surface-2 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-error/10 border border-error rounded-lg p-4">
          <p className="text-error text-sm">{error}</p>
          <button
            onClick={onRetry}
            className="mt-2 px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primary/90"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  const hasItems = sortedFolders.length > 0 || filteredDocuments.length > 0

  if (!hasItems) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[200px]">
        <FolderIcon className="h-12 w-12 text-text-tertiary mb-2" />
        <p className="text-text-secondary text-sm">暂无文件</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <select
            data-testid="sort-select"
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('-') as [string, 'asc' | 'desc']
              onSortChange(`${newSortBy}-${newSortOrder}`)
            }}
            className="text-sm border border-border-default rounded px-2 py-1 bg-surface-1"
          >
            <option value="name-asc">名称（升序）</option>
            <option value="name-desc">名称（降序）</option>
            <option value="date-desc">日期（最新）</option>
            <option value="date-asc">日期（最早）</option>
            <option value="size-desc">大小（最大）</option>
            <option value="size-asc">大小（最小）</option>
          </select>
          <select
            data-testid="filter-select"
            value={filterType}
            onChange={(e) => onFilterChange(e.target.value)}
            className="text-sm border border-border-default rounded px-2 py-1 bg-surface-1"
          >
            <option value="all">全部</option>
            <option value="image">图片</option>
            <option value="document">文档</option>
            <option value="spreadsheet">表格</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            data-testid="view-mode-grid"
            onClick={() => onViewModeChange('grid')}
            className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-surface-2 text-primary' : 'text-text-secondary'}`}
          >
            网格
          </button>
          <button
            data-testid="view-mode-list"
            onClick={() => onViewModeChange('list')}
            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-surface-2 text-primary' : 'text-text-secondary'}`}
          >
            列表
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'grid' ? (
        <div data-testid="file-manager-grid" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default text-left text-xs text-text-tertiary">
              <th className="py-2 px-3 w-8"></th>
              <th className="py-2 px-3">名称</th>
              <th className="py-2 px-3">类型</th>
              <th className="py-2 px-3 text-right">大小</th>
              <th className="py-2 px-3 text-right">日期</th>
            </tr>
          </thead>
          <tbody>
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
          </tbody>
        </table>
      )}
    </div>
  )
}
