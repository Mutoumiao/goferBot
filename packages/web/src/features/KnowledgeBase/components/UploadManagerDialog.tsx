import { useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { uploadFiles } from '../services'
import { useKbStore } from '../store'
import type { ItemSortParams } from '../types'
import { UploadDropZone } from './UploadDropZone'
import { UploadProgressBar } from './UploadProgressBar'

export interface UploadManagerDialogProps {
  kbId: string | null
  folderId: string | null
  sort?: ItemSortParams
  onClose?: (result?: unknown) => void
}

export default function UploadManagerDialog({
  kbId,
  folderId,
  sort,
  onClose,
}: UploadManagerDialogProps) {
  const uploadTasks = useKbStore((s) => s.uploadTasks)
  const clearCompletedUploads = useKbStore((s) => s.clearCompletedUploads)
  const removeUploadTask = useKbStore((s) => s.removeUploadTask)

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      if (!kbId) return
      try {
        await uploadFiles(kbId, files, folderId, sort)
      } catch {
        toast.error('上传失败，请稍后重试')
      }
    },
    [kbId, folderId, sort],
  )

  const handleRetry = useCallback(
    async (taskId: string) => {
      const task = useKbStore.getState().uploadTasks.find((t) => t.id === taskId)
      if (!task?.file || !task.kbId) {
        toast.error('无法重试：文件已失效，请重新选择')
        return
      }
      removeUploadTask(taskId)
      try {
        await uploadFiles(task.kbId, [task.file], task.folderId, sort)
      } catch {
        toast.error('重试失败，请稍后重试')
      }
    },
    [removeUploadTask, sort],
  )

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose?.(false)
      }}
    >
      <DialogContent className="sm:max-w-lg" data-testid="upload-manager-dialog">
        <DialogHeader>
          <DialogTitle>上传管理</DialogTitle>
          <DialogDescription>
            {kbId
              ? '拖拽或选择文件加入上传队列。关闭窗口不会中断上传。'
              : '当前未选择知识库，仅可查看队列与重试失败任务。'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <UploadDropZone onFilesSelected={handleFilesSelected} disabled={!kbId} />
          <UploadProgressBar
            tasks={uploadTasks}
            onRetry={handleRetry}
            onClear={clearCompletedUploads}
          />
          {uploadTasks.length === 0 && (
            <p className="text-center text-xs text-text-tertiary">暂无上传任务</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onClose?.(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
