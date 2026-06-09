import { useEffect, useState, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { getKbList, uploadFile } from '@/api/kb'
import { useKbStore } from '@/stores/kb'
import { useFileStore } from '@/stores/file'
import { BreadcrumbNav } from '@/components/kb/BreadcrumbNav'
import { FileManager } from '@/components/kb/FileManager'
import { UploadDropZone } from '@/components/kb/UploadDropZone'
import { UploadProgressBar } from '@/components/kb/UploadProgressBar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { openDialog } from '@/overlays/services/overlay-service'
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react'
import type { Folder, DocumentItem } from '@/stores/file'
import type { KbEntry } from '@goferbot/data'

type ViewMode = 'grid' | 'list'
type SortBy = 'name' | 'date' | 'size'
type SortOrder = 'asc' | 'desc'
type FilterType = 'all' | 'document' | 'image' | 'other'

export const Route = createFileRoute('/app/kb')({
  component: KbListPage,
})

function KbSkeletonCard() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/4" />
      </CardContent>
    </Card>
  )
}

export function KbListPage() {
  const { entries, isLoading: kbLoading, setEntries, setIsLoading: setKbLoading, selectedId, setSelectedId, removeEntry } = useKbStore()

  const {
    folders,
    documents,
    currentFolderId,
    isLoading: fileLoading,
    error: fileError,
    uploadTasks,
    activeUploadCount,
    breadcrumb,
    loadItems,
    addTask,
    removeTask,
    clearCompleted,
    clearError,
  } = useFileStore()

  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [loadError, setLoadError] = useState<string | null>(null)

  // Load KB list on mount
  const fetchList = useCallback(() => {
    setKbLoading(true)
    setLoadError(null)
    getKbList().send()
      .then((res) => {
        const data = (res as { data?: { entries?: unknown[] } })?.data
        if (data?.entries) setEntries(data.entries as never[])
      })
      .catch((err: unknown) => {
        const msg = (err as { message?: string })?.message || '加载失败'
        setLoadError(msg)
      })
      .finally(() => setKbLoading(false))
  }, [setEntries, setKbLoading])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  // Load items when selectedId changes
  useEffect(() => {
    if (selectedId) {
      loadItems(selectedId, null)
    }
  }, [selectedId, loadItems])

  // beforeunload 提示：有活跃上传任务时阻止离开页面
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const count = typeof activeUploadCount === 'function' ? activeUploadCount() : activeUploadCount
      if (count > 0) {
        e.preventDefault()
        e.returnValue = '有文件正在上传，确定离开吗？上传将会中断。'
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [activeUploadCount])

  const kbName = entries.find((e) => e.id === selectedId)?.name ?? 'Unknown'

  const handleFolderClick = useCallback(
    (folder: Folder) => {
      if (selectedId) {
        loadItems(selectedId, folder.id)
      }
    },
    [selectedId, loadItems],
  )

  const handleBreadcrumbNavigate = useCallback(
    (folderId: string | null) => {
      if (selectedId) {
        loadItems(selectedId, folderId)
      }
    },
    [selectedId, loadItems],
  )

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      if (!selectedId) return
      for (const file of files) {
        addTask({
          fileName: file.name,
          fileSize: file.size,
          kbId: selectedId,
          folderId: currentFolderId,
        })
        const formData = new FormData()
        formData.append('file', file)
        uploadFile(selectedId, formData)
          .then(() => {
            // upload succeeded
          })
          .catch(() => {
            // upload failed
          })
      }
    },
    [selectedId, currentFolderId, addTask],
  )

  const handleRetryUpload = useCallback(
    (taskId: string) => {
      const task = uploadTasks.find((t) => t.id === taskId)
      if (!task || !selectedId) return
      removeTask(taskId)
      addTask({
        fileName: task.fileName,
        fileSize: task.fileSize,
        kbId: selectedId,
        folderId: currentFolderId,
      })
    },
    [selectedId, currentFolderId, uploadTasks, addTask, removeTask],
  )

  const handleRetryLoad = useCallback(() => {
    if (selectedId) {
      clearError()
      loadItems(selectedId, currentFolderId)
    }
  }, [selectedId, currentFolderId, loadItems, clearError])

  const handleSortChange = useCallback((sortValue: string) => {
    const [newSortBy, newSortOrder] = sortValue.split('-') as [SortBy, SortOrder]
    setSortBy(newSortBy)
    setSortOrder(newSortOrder)
  }, [])

  const handleFilterChange = useCallback((newFilterType: string) => {
    setFilterType(newFilterType as FilterType)
  }, [])

  const handleDocumentClick = useCallback((_doc: DocumentItem) => {
    // Document click handled by f-47 (download/preview)
  }, [])

  // CRUD handlers
  const handleCreate = async () => {
    const CreateKbDialog = (await import('@/overlays/dialogs/CreateKbDialog')).default
    await openDialog(CreateKbDialog, {
      onConfirm: () => {
        fetchList()
      },
    })
  }

  const handleEdit = async (e: React.MouseEvent, entry: KbEntry) => {
    e.stopPropagation()
    const EditKbDialog = (await import('@/overlays/dialogs/EditKbDialog')).default
    await openDialog(EditKbDialog, {
      entry,
      onConfirm: () => {
        fetchList()
      },
    })
  }

  const handleDelete = async (e: React.MouseEvent, entry: KbEntry) => {
    e.stopPropagation()
    const DeleteKbDialog = (await import('@/overlays/dialogs/DeleteKbDialog')).default
    const result = await openDialog(DeleteKbDialog, {
      kbId: entry.id,
      kbName: entry.name,
      onConfirm: () => {
        removeEntry(entry.id)
      },
    })
    if (result === 'refresh') {
      fetchList()
    }
  }

  const handleCardClick = (entry: KbEntry) => {
    setSelectedId(entry.id)
  }

  // KB List view (no selected KB)
  if (!selectedId) {
    return (
      <div className="h-full p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">知识库</h1>
            <p className="mt-1 text-sm text-text-secondary">管理你的知识库文档</p>
          </div>
          <Button
            onClick={handleCreate}
            disabled={kbLoading}
            className="inline-flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            创建知识库
          </Button>
        </div>

        {kbLoading ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KbSkeletonCard />
            <KbSkeletonCard />
            <KbSkeletonCard />
          </div>
        ) : loadError ? (
          <div className="mt-16 flex flex-col items-center justify-center gap-3">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button variant="outline" onClick={fetchList} className="inline-flex items-center gap-1">
              <RefreshCw className="h-4 w-4" />
              重试
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="mt-16 flex flex-col items-center justify-center gap-4">
            <p className="text-text-secondary">暂无知识库</p>
            <Button onClick={handleCreate} className="inline-flex items-center gap-1">
              <Plus className="h-4 w-4" />
              创建第一个知识库
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <Card
                key={entry.id}
                className="cursor-pointer hover:shadow-sm transition-shadow group relative"
                onClick={() => handleCardClick(entry)}
              >
                <CardContent className="pt-6">
                  <h3 className="font-medium text-text-primary pr-12">{entry.name}</h3>
                  {entry.description && (
                    <p className="mt-1 text-xs text-text-secondary line-clamp-2">{entry.description}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2 text-xs text-text-tertiary">
                    <span>{entry.fileCount ?? 0} 个文件</span>
                  </div>

                  {/* 操作按钮 — 悬停显示 */}
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => handleEdit(e, entry)}
                      aria-label="编辑"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => handleDelete(e, entry)}
                      aria-label="删除"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  // KB Detail view (file manager)
  return (
    <div className="h-full p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">知识库</h1>
          <p className="mt-1 text-sm text-text-secondary">管理你的知识库文档</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center gap-1"
        >
          ← 返回列表
        </Button>
      </div>

      <div className="mt-4">
        <BreadcrumbNav
          items={typeof breadcrumb === 'function' ? breadcrumb() : breadcrumb}
          currentKbName={kbName}
          onNavigate={handleBreadcrumbNavigate}
        />
      </div>

      <div className="mt-4">
        <UploadDropZone kbId={selectedId} onFilesSelected={handleFilesSelected} />
      </div>

      <div className="mt-4">
        <UploadProgressBar
          tasks={uploadTasks}
          activeUploadCount={typeof activeUploadCount === 'function' ? activeUploadCount() : activeUploadCount}
          onRetry={handleRetryUpload}
          onClear={clearCompleted}
        />
      </div>

      <div className="mt-6">
        <FileManager
          folders={folders}
          documents={documents}
          isLoading={fileLoading}
          error={fileError}
          viewMode={viewMode}
          sortBy={sortBy}
          sortOrder={sortOrder}
          filterType={filterType}
          onFolderClick={handleFolderClick}
          onDocumentClick={handleDocumentClick}
          onRetry={handleRetryLoad}
          onViewModeChange={setViewMode}
          onSortChange={handleSortChange}
          onFilterChange={handleFilterChange}
        />
      </div>
    </div>
  )
}
