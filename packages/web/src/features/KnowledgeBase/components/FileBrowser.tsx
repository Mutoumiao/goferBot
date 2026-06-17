import { useState, useCallback, useEffect, useMemo } from 'react'
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
import { loadKbItems, uploadFiles, renameItem, removeItem, addFolder, previewDocument, searchKbItems } from '../services'
import { KnowledgeBaseToolbar } from './KnowledgeBaseToolbar'
import { FileGridItem } from './FileGridItem'
import { FileListItem } from './FileListItem'
import { UploadDropZone } from './UploadDropZone'
import { UploadProgressBar } from './UploadProgressBar'
import { FileContextMenu } from './FileContextMenu'
import { openDialog } from '@/overlays/services/overlay-service'
import { parseSortOption, type Folder, type DocumentItem, type ViewMode, type SortOption } from '../types'

interface FileBrowserProps {
  kbName: string
}

function LoadingState() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} data-testid="skeleton-card" className="h-32 bg-[#F7F8FA] rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px]">
      <FolderIcon className="h-12 w-12 text-text-tertiary mb-2" />
      <p className="text-text-secondary text-sm">暂无文件</p>
    </div>
  )
}

interface FileViewProps {
  folders: Folder[]
  documents: DocumentItem[]
  folderDocumentCounts: Map<string, number>
  totalCount: number
  onFolderClick: (folder: Folder) => void
  onDocumentClick: (doc: DocumentItem) => void
  onOpenItem: (item: Folder | DocumentItem) => void
  onRenameItem: (item: Folder | DocumentItem) => void
  onDeleteItem: (item: Folder | DocumentItem) => void
  onMoveItem: (doc: DocumentItem) => void
}

function GridView({
  folders,
  documents,
  folderDocumentCounts,
  totalCount,
  onFolderClick,
  onDocumentClick,
  onOpenItem,
  onRenameItem,
  onDeleteItem,
  onMoveItem,
}: FileViewProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-3">
        {folders.map((folder) => (
          <FileContextMenu
            key={folder.id}
            item={folder}
            onOpen={onOpenItem}
            onRename={onRenameItem}
            onDelete={onDeleteItem}
          >
            <div>
              <FileGridItem
                item={folder}
                isFolder
                documentCount={folderDocumentCounts.get(folder.id) ?? 0}
                onClick={() => onFolderClick(folder)}
              />
            </div>
          </FileContextMenu>
        ))}
        {documents.map((doc) => (
          <FileContextMenu
            key={doc.id}
            item={doc}
            onRename={onRenameItem}
            onDelete={onDeleteItem}
            onMove={onMoveItem}
          >
            <div>
              <FileGridItem item={doc} isFolder={false} onClick={() => onDocumentClick(doc)} />
            </div>
          </FileContextMenu>
        ))}
      </div>
      <div className="flex justify-center py-2 text-sm text-[#9AA3AF]">共 {totalCount} 项</div>
    </div>
  )
}

function ListView({
  folders,
  documents,
  totalCount,
  onFolderClick,
  onDocumentClick,
  onOpenItem,
  onRenameItem,
  onDeleteItem,
  onMoveItem,
}: Omit<FileViewProps, 'folderDocumentCounts'>) {
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
          {folders.map((folder) => (
            <FileContextMenu
              key={folder.id}
              item={folder}
              onOpen={onOpenItem}
              onRename={onRenameItem}
              onDelete={onDeleteItem}
            >
              <FileListItem
                item={folder}
                isFolder
                onClick={() => onFolderClick(folder)}
              />
            </FileContextMenu>
          ))}
          {documents.map((doc) => (
            <FileContextMenu
              key={doc.id}
              item={doc}
              onRename={onRenameItem}
              onDelete={onDeleteItem}
              onMove={onMoveItem}
            >
              <FileListItem
                item={doc}
                isFolder={false}
                onClick={() => onDocumentClick(doc)}
              />
            </FileContextMenu>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-center py-2 text-sm text-[#9AA3AF]">共 {totalCount} 项</div>
    </div>
  )
}

export function FileBrowser({ kbName }: FileBrowserProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortOption, setSortOption] = useState<SortOption>('updatedAt-desc')
  const [isDragOver, setIsDragOver] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const {
    folders,
    documents,
    fileLoading,
    fileError,
    breadcrumbs,
    setCurrentFolderId,
    currentKbId,
    currentFolderId,
    uploadTasks,
    activeUploadCount,
    clearCompletedUploads,
    removeUploadTask,
  } = useKbStore()

  const sortParams = useMemo(() => parseSortOption(sortOption), [sortOption])

  const folderDocumentCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const doc of documents) {
      if (!doc.folderId) continue
      counts.set(doc.folderId, (counts.get(doc.folderId) ?? 0) + 1)
    }
    return counts
  }, [documents])

  useEffect(() => {
    if (!currentKbId) return

    const trimmed = searchQuery.trim()
    if (!trimmed) {
      loadKbItems(currentKbId, currentFolderId, sortParams)
      return
    }

    const timer = setTimeout(() => {
      searchKbItems(trimmed)
    }, 300)
    return () => clearTimeout(timer)
  }, [currentKbId, currentFolderId, searchQuery, sortParams])

  const handleFolderClick = useCallback((folder: Folder) => {
    setCurrentFolderId(folder.id)
  }, [setCurrentFolderId])

  const handleDocumentClick = useCallback(async (doc: DocumentItem) => {
    const preview = await previewDocument(doc.id)
    if (!preview) return
    const PreviewDialog = (await import('@/overlays/dialogs/PreviewDialog')).default
    await openDialog(PreviewDialog, { document: doc, preview })
  }, [])

  const handleNavigate = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId)
  }, [setCurrentFolderId])

  const handleOpenItem = useCallback((item: Folder | DocumentItem) => {
    if (!('status' in item)) {
      setCurrentFolderId(item.id)
    }
  }, [setCurrentFolderId])

  const handleRenameItem = useCallback(async (item: Folder | DocumentItem) => {
    const RenameItemDialog = (await import('@/overlays/dialogs/RenameItemDialog')).default
    await openDialog(RenameItemDialog, {
      itemName: item.name,
      isFolder: !('status' in item),
      onConfirm: async (newName: string) => {
        await renameItem(item, newName)
      },
    })
  }, [])

  const handleDeleteItem = useCallback(async (item: Folder | DocumentItem) => {
    const DeleteItemDialog = (await import('@/overlays/dialogs/DeleteItemDialog')).default
    await openDialog(DeleteItemDialog, {
      itemName: item.name,
      isFolder: !('status' in item),
      onConfirm: async () => {
        await removeItem(item)
      },
    })
  }, [])

  const handleMoveItem = useCallback(async (doc: DocumentItem) => {
    const MoveDocumentDialog = (await import('./MoveDocumentDialog')).default
    await openDialog(MoveDocumentDialog, {
      docId: doc.id,
      docName: doc.name,
      onConfirm: async () => {
        if (!currentKbId) return
        await loadKbItems(currentKbId, currentFolderId, sortParams)
      },
    })
  }, [currentKbId, currentFolderId, sortParams])

  const handleCreateFolder = useCallback(async () => {
    if (!currentKbId) return
    const CreateFolderDialog = (await import('@/overlays/dialogs/CreateFolderDialog')).default
    await openDialog(CreateFolderDialog, {
      onConfirm: async (name: string) => {
        await addFolder(currentKbId, name, currentFolderId)
      },
    })
  }, [currentKbId, currentFolderId])

  const handleRetry = useCallback(() => {
    if (!currentKbId) return
    const trimmed = searchQuery.trim()
    if (trimmed) {
      searchKbItems(trimmed)
    } else {
      loadKbItems(currentKbId, currentFolderId, sortParams)
    }
  }, [currentKbId, currentFolderId, searchQuery, sortParams])

  const handleUploadComplete = useCallback(async (kbId: string, files: File[], targetFolderId?: string | null) => {
    const folderId = targetFolderId ?? currentFolderId
    await uploadFiles(kbId, files, folderId, sortParams)
    if (searchQuery.trim()) {
      setSearchQuery('')
      await loadKbItems(kbId, folderId, sortParams)
    }
  }, [currentFolderId, searchQuery, sortParams])

  const handleUpload = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = '.md,.txt,.html,.csv,.json,.pdf'
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files
      if (!files) return
      const { currentKbId: latestKbId, currentFolderId: latestFolderId } = useKbStore.getState()
      if (!latestKbId) return
      await handleUploadComplete(latestKbId, Array.from(files), latestFolderId)
      input.remove()
    }
    input.click()
  }, [handleUploadComplete])

  const handleDropFiles = useCallback(async (files: File[]) => {
    if (!currentKbId) return
    await handleUploadComplete(currentKbId, files, currentFolderId)
  }, [currentKbId, currentFolderId, handleUploadComplete])

  const handleRetryUpload = useCallback(async (taskId: string) => {
    const task = uploadTasks.find((t) => t.id === taskId)
    if (!task || !currentKbId || !task.file) return
    removeUploadTask(taskId)
    await handleUploadComplete(currentKbId, [task.file], task.folderId)
  }, [uploadTasks, currentKbId, removeUploadTask, handleUploadComplete])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0 && currentKbId) {
      await handleUploadComplete(currentKbId, Array.from(e.dataTransfer.files), currentFolderId)
    }
  }, [currentKbId, currentFolderId, handleUploadComplete])

  const renderContent = () => {
    if (fileLoading) {
      return <LoadingState />
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

    const totalCount = folders.length + documents.length

    if (totalCount === 0) {
      return <EmptyState />
    }

    const viewProps = {
      folders,
      documents,
      totalCount,
      onFolderClick: handleFolderClick,
      onDocumentClick: handleDocumentClick,
      onOpenItem: handleOpenItem,
      onRenameItem: handleRenameItem,
      onDeleteItem: handleDeleteItem,
      onMoveItem: handleMoveItem,
    }

    if (viewMode === 'grid') {
      return <GridView {...viewProps} folderDocumentCounts={folderDocumentCounts} />
    }

    return <ListView {...viewProps} />
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
        breadcrumb={breadcrumbs}
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
