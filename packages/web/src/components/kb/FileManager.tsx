import { FolderIcon } from 'lucide-react'
import type { Folder, DocumentItem } from '@/stores/file'
import { FileGridItem } from './FileGridItem'
import { FileListItem } from './FileListItem'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
          <Select
            value={`${sortBy}-${sortOrder}`}
            onValueChange={onSortChange}
          >
            <SelectTrigger data-testid="sort-select" className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">名称（升序）</SelectItem>
              <SelectItem value="name-desc">名称（降序）</SelectItem>
              <SelectItem value="date-desc">日期（最新）</SelectItem>
              <SelectItem value="date-asc">日期（最早）</SelectItem>
              <SelectItem value="size-desc">大小（最大）</SelectItem>
              <SelectItem value="size-asc">大小（最小）</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filterType}
            onValueChange={onFilterChange}
          >
            <SelectTrigger data-testid="filter-select" className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="image">图片</SelectItem>
              <SelectItem value="document">文档</SelectItem>
              <SelectItem value="spreadsheet">表格</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            data-testid="view-mode-grid"
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('grid')}
          >
            网格
          </Button>
          <Button
            data-testid="view-mode-list"
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('list')}
          >
            列表
          </Button>
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
      )}
    </div>
  )
}
