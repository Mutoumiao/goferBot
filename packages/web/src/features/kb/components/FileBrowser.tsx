import { useState, useCallback, useEffect } from 'react'
import { FolderIcon, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useKbStore } from '../store'
import { loadKbItems, uploadFiles } from '../services'
import { KnowledgeBaseToolbar } from './KnowledgeBaseToolbar'
import { FileGridItem } from './FileGridItem'
import { FileListItem } from './FileListItem'
import { UploadDropZone } from './UploadDropZone'
import { UploadProgressBar } from './UploadProgressBar'
import { FileContextMenu } from './FileContextMenu'
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
  const [isDragOver, setIsDragOver] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const {
    folders,
    documents,
    fileLoading,
    fileError,
    breadcrumb,
    setCurrentFolderId,
    currentKbId,
    currentFolderId,
    uploadTasks,
    activeUploadCount,
    clearCompletedUploads,
    removeUploadTask,
  } = useKbStore()

  const { sortOrder } = parseSortOption(sortOption)

  useEffect(() => {
    if (currentKbId) {
      loadKbItems(currentKbId, currentFolderId)
    }
  }, [currentKbId, currentFolderId])

  const handleFolderClick = useCallback((folder: Folder) => {
    setCurrentFolderId(folder.id)
  }, [setCurrentFolderId])

  const handleDocumentClick = useCallback((_doc: DocumentItem) => {
    // Document click handled by f-47 (download/preview)
  }, [])

  const handleNavigate = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId)
  }, [setCurrentFolderId])

  const handleOpenItem = useCallback((item: Folder | DocumentItem) => {
    if (!('status' in item)) {
      setCurrentFolderId(item.id)
    }
  }, [setCurrentFolderId])

  const handleRenameItem = useCallback((_item: Folder | DocumentItem) => {
    // TODO: f-48 重命名功能
  }, [])

  const handleDeleteItem = useCallback((_item: Folder | DocumentItem) => {
    // TODO: f-48 删除功能
  }, [])

  const handleCreateFolder = useCallback(() => {
    // TODO: f-48 新建文件夹功能
  }, [])

  const handleRetry = useCallback(() => {
    if (currentKbId) {
      loadKbItems(currentKbId, currentFolderId)
    }
  }, [currentKbId, currentFolderId])

  const handleUpload = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files
      if (files && currentKbId) {
        uploadFiles(currentKbId, Array.from(files), currentFolderId)
      }
    }
    input.click()
  }, [currentKbId, currentFolderId])

  const handleDropFiles = useCallback((files: File[]) => {
    if (currentKbId) {
      uploadFiles(currentKbId, files, currentFolderId)
    }
  }, [currentKbId, currentFolderId])

  const handleRetryUpload = useCallback((taskId: string) => {
    const task = uploadTasks.find((t) => t.id === taskId)
    if (!task || !currentKbId) return
    removeUploadTask(taskId)
    // 由于原始 File 对象无法从 task 恢复，重试功能需要用户重新选择文件
    // #adjacent-fix: 恢复文件对象后实现真正重试
  }, [uploadTasks, currentKbId, removeUploadTask])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0 && currentKbId) {
      uploadFiles(currentKbId, Array.from(e.dataTransfer.files), currentFolderId)
    }
  }, [currentKbId, currentFolderId])

  const filteredFolders = searchQuery.trim()
    ? folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : folders

  const filteredDocuments = searchQuery.trim()
    ? documents.filter((d) => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : documents

  const sortedFolders = [...filteredFolders].sort((a, b) => {
    const aName = a.name.toLowerCase()
    const bName = b.name.toLowerCase()
    return sortOrder === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName)
  })

  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
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
              <FileContextMenu
                key={folder.id}
                item={folder}
                onOpen={handleOpenItem}
                onRename={handleRenameItem}
                onDelete={handleDeleteItem}
              >
                <div>
                  <FileGridItem
                    item={folder}
                    isFolder
                    documentCount={sortedDocuments.filter((d) => d.folderId === folder.id).length}
                    onClick={() => handleFolderClick(folder)}
                  />
                </div>
              </FileContextMenu>
            ))}
            {sortedDocuments.map((doc) => (
              <FileContextMenu
                key={doc.id}
                item={doc}
                onRename={handleRenameItem}
                onDelete={handleDeleteItem}
              >
                <div>
                  <FileGridItem item={doc} isFolder={false} onClick={() => handleDocumentClick(doc)} />
                </div>
              </FileContextMenu>
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
              <FileListItem
                key={folder.id}
                item={folder}
                isFolder
                onClick={() => handleFolderClick(folder)}
              />
            ))}
            {sortedDocuments.map((doc) => (
              <FileListItem
                key={doc.id}
                item={doc}
                isFolder={false}
                onClick={() => handleDocumentClick(doc)}
              />
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-center py-2 text-sm text-[#9AA3AF]">共 {totalCount} 项</div>
      </div>
    )
  }

  return (
    <div
      className="relative flex flex-1 flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_2px_8px_rgba(160,158,158,0.25)]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <KnowledgeBaseToolbar
        kbName={kbName}
        breadcrumb={breadcrumb()}
        onNavigate={handleNavigate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortOption={sortOption}
        onSortChange={setSortOption}
        onUpload={handleUpload}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {isDragOver && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#5B7CFA]/10">
          <div className="rounded-2xl border-2 border-dashed border-[#5B7CFA] bg-white px-8 py-6 text-center shadow-lg">
            <Upload className="mx-auto h-10 w-10 text-[#5B7CFA]" />
            <p className="mt-2 text-sm font-medium text-[#1F2328]">释放文件以上传</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {currentKbId && (
          <UploadDropZone kbId={currentKbId} onFilesSelected={handleDropFiles} />
        )}
        <UploadProgressBar
          tasks={uploadTasks}
          activeUploadCount={activeUploadCount()}
          onRetry={handleRetryUpload}
          onClear={clearCompletedUploads}
        />
        <FileContextMenu item={null} onCreateFolder={handleCreateFolder}>
          <div className="min-h-[200px]">{renderContent()}</div>
        </FileContextMenu>
      </div>
    </div>
  )
}
