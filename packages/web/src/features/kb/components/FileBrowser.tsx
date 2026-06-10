import { useState, useCallback } from 'react'
import { FolderIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useKbStore } from '../store'
import { loadKbItems } from '../services'
import { KnowledgeBaseToolbar } from './KnowledgeBaseToolbar'
import { FileGridItem } from './FileGridItem'
import { FileListItem } from './FileListItem'
import type { Folder, DocumentItem, ViewMode, SortOption } from '../types'

interface FileBrowserProps {
  kbName: string
}

function parseSortOption(option: SortOption): { sortBy: 'name' | 'date' | 'size'; sortOrder: 'asc' | 'desc' } {
  const [sortBy, sortOrder] = option.split('-') as ['name' | 'date' | 'size', 'asc' | 'desc']
  return { sortBy, sortOrder }
}

export function FileBrowser({ kbName }: FileBrowserProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortOption, setSortOption] = useState<SortOption>('date-desc')

  const {
    folders,
    documents,
    fileLoading,
    fileError,
    breadcrumb,
    setCurrentFolderId,
    currentKbId,
    currentFolderId,
  } = useKbStore()

  const { sortOrder } = parseSortOption(sortOption)

  const handleFolderClick = useCallback((folder: Folder) => {
    setCurrentFolderId(folder.id)
  }, [setCurrentFolderId])

  const handleDocumentClick = useCallback((_doc: DocumentItem) => {
    // Document click handled by f-47 (download/preview)
  }, [])

  const handleNavigate = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId)
  }, [setCurrentFolderId])

  const handleRetry = useCallback(() => {
    if (currentKbId) {
      loadKbItems(currentKbId, currentFolderId)
    }
  }, [currentKbId, currentFolderId])

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

  const renderContent = () => {
    if (fileLoading) {
      return (
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} data-testid="skeleton-card" className="h-32 bg-[#F7F8FA] rounded-xl animate-pulse" />
          ))}
        </div>
      )
    }

    if (fileError) {
      return (
        <div className="bg-error/10 border border-error rounded-lg p-4">
          <p className="text-error text-sm">{fileError}</p>
          <Button variant="destructive" size="sm" onClick={handleRetry} className="mt-2">
            重试
          </Button>
        </div>
      )
    }

    const hasItems = sortedFolders.length > 0 || sortedDocuments.length > 0
    const totalCount = sortedFolders.length + sortedDocuments.length

    if (!hasItems) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px]">
          <FolderIcon className="h-12 w-12 text-text-tertiary mb-2" />
          <p className="text-text-secondary text-sm">暂无文件</p>
        </div>
      )
    }

    if (viewMode === 'grid') {
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-4 gap-3">
            {sortedFolders.map((folder) => (
              <FileGridItem key={folder.id} item={folder} isFolder onClick={() => handleFolderClick(folder)} />
            ))}
            {sortedDocuments.map((doc) => (
              <FileGridItem key={doc.id} item={doc} isFolder={false} onClick={() => handleDocumentClick(doc)} />
            ))}
          </div>
          <div className="flex justify-center py-2 text-sm text-[#9AA3AF]">共 {totalCount} 项</div>
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
              <FileListItem key={folder.id} item={folder} isFolder onClick={() => handleFolderClick(folder)} />
            ))}
            {sortedDocuments.map((doc) => (
              <FileListItem key={doc.id} item={doc} isFolder={false} onClick={() => handleDocumentClick(doc)} />
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-center py-2 text-sm text-[#9AA3AF]">共 {totalCount} 项</div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_2px_8px_rgba(160,158,158,0.25)]">
      <KnowledgeBaseToolbar
        kbName={kbName}
        breadcrumb={breadcrumb()}
        onNavigate={handleNavigate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortOption={sortOption}
        onSortChange={setSortOption}
      />

      <div className="flex-1 overflow-auto p-6">{renderContent()}</div>
    </div>
  )
}
