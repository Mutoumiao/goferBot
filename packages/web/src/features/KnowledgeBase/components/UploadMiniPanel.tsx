import { AlertCircle, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { openUploadManager } from '../open-upload-manager'
import { useKbStore } from '../store'

/**
 * 右下角迷你进度浮层。
 * z-index 须 < Overlay 起点 1000，避免盖住上传管理 Dialog。
 */
export function UploadMiniPanel() {
  const uploadTasks = useKbStore((s) => s.uploadTasks)
  const uploadManagerOpen = useKbStore((s) => s.uploadManagerOpen)
  const uploadMiniDismissed = useKbStore((s) => s.uploadMiniDismissed)
  const setUploadMiniDismissed = useKbStore((s) => s.setUploadMiniDismissed)
  const clearCompletedUploads = useKbStore((s) => s.clearCompletedUploads)

  const summary = useMemo(() => {
    const pending = uploadTasks.filter((t) => t.status === 'queued' || t.status === 'uploading')
    const failed = uploadTasks.filter((t) => t.status === 'failed')
    const completed = uploadTasks.filter((t) => t.status === 'completed')
    const totalProgress =
      uploadTasks.length > 0
        ? Math.round(uploadTasks.reduce((sum, t) => sum + t.progress, 0) / uploadTasks.length)
        : 0
    return {
      pendingCount: pending.length,
      failedCount: failed.length,
      completedCount: completed.length,
      totalCount: uploadTasks.length,
      totalProgress,
      hasRelevant: pending.length > 0 || failed.length > 0,
      allSuccess:
        uploadTasks.length > 0 &&
        pending.length === 0 &&
        failed.length === 0 &&
        completed.length > 0,
    }
  }, [uploadTasks])

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current)
      successTimerRef.current = null
    }
    if (uploadManagerOpen || uploadMiniDismissed) return
    if (!summary.allSuccess) return

    successTimerRef.current = setTimeout(() => {
      clearCompletedUploads()
    }, 2000)

    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current)
        successTimerRef.current = null
      }
    }
  }, [summary.allSuccess, uploadManagerOpen, uploadMiniDismissed, clearCompletedUploads])

  const visible =
    !uploadManagerOpen && !uploadMiniDismissed && (summary.hasRelevant || summary.allSuccess)

  if (!visible) return null

  let title: string
  if (summary.pendingCount > 0) {
    const done = summary.completedCount
    const total = summary.totalCount
    title = `正在上传 ${done}/${total}`
  } else if (summary.failedCount > 0) {
    title = `${summary.failedCount} 个上传失败`
  } else {
    title = '上传完成'
  }

  return (
    <div
      data-testid="upload-mini-panel"
      className="fixed bottom-6 right-6 z-40 w-72 rounded-xl border border-[#E7EAF0] bg-white p-3 shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
          onClick={() => {
            void openUploadManager()
          }}
          aria-label="打开上传管理"
        >
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F4F5F7]">
            {summary.failedCount > 0 && summary.pendingCount === 0 ? (
              <AlertCircle className="h-4 w-4 text-red-500" />
            ) : (
              <Upload className="h-4 w-4 text-[#5B7CFA]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-sm font-medium ${
                summary.failedCount > 0 && summary.pendingCount === 0
                  ? 'text-red-600'
                  : 'text-[#1F2328]'
              }`}
            >
              {title}
            </p>
            {summary.pendingCount > 0 && (
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#F4F5F7]">
                <div
                  className="h-full rounded-full bg-[#5B7CFA] transition-all duration-300"
                  style={{ width: `${summary.totalProgress}%` }}
                />
              </div>
            )}
            {summary.failedCount > 0 && summary.pendingCount === 0 && (
              <p className="mt-0.5 text-xs text-red-500">点击查看并重试</p>
            )}
          </div>
        </button>
        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-[#9AA3AF] hover:bg-[#F4F5F7] hover:text-[#5E6673]"
          onClick={() => setUploadMiniDismissed(true)}
          aria-label="收起上传进度"
          title="收起"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
