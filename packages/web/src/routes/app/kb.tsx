import { useEffect, useState, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { getKbList, uploadFile } from '@/api/kb'
import { useKbStore } from '@/stores/kb'
import { useFileStore } from '@/stores/file'
import { BreadcrumbNav } from '@/components/kb/BreadcrumbNav'
import { FileManager } from '@/components/kb/FileManager'
import { UploadDropZone } from '@/components/kb/UploadDropZone'
import { UploadProgressBar } from '@/components/kb/UploadProgressBar'
import type { Folder, DocumentItem } from '@/stores/file'

type ViewMode = 'grid' | 'list'
type SortBy = 'name' | 'date' | 'size'
type SortOrder = 'asc' | 'desc'
type FilterType = 'all' | 'document' | 'image' | 'other'

export const Route = createFileRoute('/app/kb')({
  component: KbListPage,
})

export function KbListPage() {
  const { entries, isLoading: kbLoading, setEntries, setIsLoading: setKbLoading, selectedId, setSelectedId } = useKbStore()

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

  // Load KB list on mount
  useEffect(() => {
    setKbLoading(true)
    getKbList().send()
      .then((res) => {
        const data = (res as { data?: { entries?: unknown[] } })?.data
        if (data?.entries) setEntries(data.entries as never[])
      })
      .finally(() => setKbLoading(false))
  }, [])

  // Load items when selectedId changes
  useEffect(() => {
    if (selectedId) {
      loadItems(selectedId, null)
    }
  }, [selectedId])

  // beforeunload 提示：有活跃上传任务时阻止离开页面
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const count = typeof activeUploadCount === 'function' ? activeUploadCount() : activeUploadCount
      if (count > 0) {
        e.preventDefault()
        // 现代浏览器忽略自定义消息，但需要设置 returnValue 才能触发提示
        e.returnValue = '有文件正在上传，确定离开吗？上传将会中断。'
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [activeUploadCount])

  const kbName = entries.find((e) => e.id === selectedId)?.title ?? 'Unknown'

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
            // upload succeeded — store handles status internally via processQueue
          })
          .catch(() => {
            // upload failed — store handles status internally
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
      // Re-add and re-upload
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

  // KB List view (no selected KB)
  if (!selectedId) {
    return (
      <div className="h-full p-6">
        <h1 className="text-xl font-bold text-text-primary">知识库</h1>
        <p className="mt-1 text-sm text-text-secondary">管理你的知识库文档</p>

        {kbLoading ? (
          <div className="mt-8 text-center text-sm text-text-secondary">加载中...</div>
        ) : entries.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="text-text-secondary">暂无知识库</p>
            <p className="mt-2 text-xs text-text-tertiary">点击右上角 + 创建知识库</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-border-default bg-surface-1 p-4 hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => setSelectedId(entry.id)}
              >
                <h3 className="font-medium text-text-primary">{entry.title}</h3>
                {entry.description && (
                  <p className="mt-1 text-xs text-text-secondary line-clamp-2">{entry.description}</p>
                )}
                <div className="mt-3 flex items-center gap-2 text-xs text-text-tertiary">
                  <span>📄 {entry.fileCount ?? 0} 个文件</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // KB Detail view (file manager)
  return (
    <div className="h-full p-6">
      <h1 className="text-xl font-bold text-text-primary">知识库</h1>
      <p className="mt-1 text-sm text-text-secondary">管理你的知识库文档</p>

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
