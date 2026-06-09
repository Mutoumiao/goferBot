import { useState, useCallback } from 'react'
import { FileManager } from '@/components/kb/FileManager'
import { Header } from './Header'
import { useFileStore } from '@/stores/file'
import type { Folder, DocumentItem } from '@/stores/file'

type ViewMode = 'grid' | 'list'
type SortOption = 'name-asc' | 'name-desc' | 'date-desc' | 'date-asc'
type FilterType = 'all' | 'document' | 'image' | 'other'

const MOCK_FOLDERS: Folder[] = [
  { id: 'f1', kbId: '1', parentId: null, name: 'docs', createdAt: '2024-04-12T16:30:00Z', updatedAt: '2024-04-12T16:30:00Z' },
  { id: 'f2', kbId: '1', parentId: null, name: '调研原始资料', createdAt: '2024-04-11T10:20:00Z', updatedAt: '2024-04-11T10:20:00Z' },
  { id: 'f3', kbId: '1', parentId: null, name: '会议纪要', createdAt: '2024-04-10T09:15:00Z', updatedAt: '2024-04-10T09:15:00Z' },
  { id: 'f4', kbId: '1', parentId: null, name: '竞品分析', createdAt: '2024-04-09T14:22:00Z', updatedAt: '2024-04-09T14:22:00Z' },
]

const MOCK_DOCUMENTS: DocumentItem[] = [
  { id: 'd1', kbId: '1', folderId: null, name: '产品调研.pdf', ext: 'pdf', mimeType: 'application/pdf', size: 2516582, status: 'ready', createdAt: '2024-04-12T15:45:00Z', updatedAt: '2024-04-12T15:45:00Z' },
  { id: 'd2', kbId: '1', folderId: null, name: '竞品网页摘录.xlsx', ext: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 159744, status: 'ready', createdAt: '2024-04-12T11:20:00Z', updatedAt: '2024-04-12T11:20:00Z' },
  { id: 'd3', kbId: '1', folderId: null, name: '机会点整理.pptx', ext: 'pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', size: 3670016, status: 'ready', createdAt: '2024-04-11T17:33:00Z', updatedAt: '2024-04-11T17:33:00Z' },
  { id: 'd4', kbId: '1', folderId: null, name: 'SKILL.md', ext: 'md', mimeType: 'text/markdown', size: 2355, status: 'ready', createdAt: '2024-04-12T15:45:00Z', updatedAt: '2024-04-12T15:45:00Z' },
]

interface MainProps {
  fileLoading: boolean
  fileError: string | null
  kbName: string
  breadcrumb: Folder[] | (() => Folder[])
  onNavigate: (folderId: string | null) => void
}

function parseSortOption(option: SortOption): { sortBy: 'name' | 'date' | 'size'; sortOrder: 'asc' | 'desc' } {
  const [sortBy, sortOrder] = option.split('-') as ['name' | 'date' | 'size', 'asc' | 'desc']
  return { sortBy, sortOrder }
}

export function Main({
  fileLoading,
  fileError,
  kbName,
  breadcrumb,
  onNavigate,
}: MainProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortOption, setSortOption] = useState<SortOption>('date-desc')
  const [_filterType, _setFilterType] = useState<FilterType>('all')

  const { sortBy, sortOrder } = parseSortOption(sortOption)

  const handleFolderClick = useCallback((folder: Folder) => {
    useFileStore.setState({
      currentFolderId: folder.id,
      folders: [],
      documents: MOCK_DOCUMENTS.filter(d => d.folderId === folder.id),
    })
  }, [])

  const handleDocumentClick = useCallback((_doc: DocumentItem) => {
    // Document click handled by f-47 (download/preview)
  }, [])

  const handleRetry = useCallback(() => {
    useFileStore.setState({
      folders: MOCK_FOLDERS,
      documents: MOCK_DOCUMENTS,
      isLoading: false,
      error: null,
    })
  }, [])

  const { folders, documents } = useFileStore()

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_2px_8px_rgba(160,158,158,0.25)]">
      <Header
        kbName={kbName}
        breadcrumb={breadcrumb}
        onNavigate={onNavigate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortOption={sortOption}
        onSortChange={setSortOption}
      />

      <div className="flex-1 overflow-auto p-6">
        <FileManager
          folders={folders}
          documents={documents}
          isLoading={fileLoading}
          error={fileError}
          viewMode={viewMode}
          sortBy={sortBy}
          sortOrder={sortOrder}
          filterType="all"
          onFolderClick={handleFolderClick}
          onDocumentClick={handleDocumentClick}
          onRetry={handleRetry}
          onViewModeChange={setViewMode}
          onSortChange={(sortValue) => setSortOption(sortValue as SortOption)}
          onFilterChange={(filterValue) => _setFilterType(filterValue as FilterType)}
        />
      </div>
    </div>
  )
}
