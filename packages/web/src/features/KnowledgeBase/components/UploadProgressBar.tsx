import { AlertCircle, RefreshCw, X } from 'lucide-react'
import type { UploadTask } from '../types'

interface UploadProgressBarProps {
  tasks: UploadTask[]
  activeUploadCount: number
  onRetry: (taskId: string) => void
  onClear: () => void
}

export function UploadProgressBar({
  tasks,
  activeUploadCount,
  onRetry,
  onClear,
}: UploadProgressBarProps) {
  if (tasks.length === 0) return null

  const totalProgress =
    tasks.length > 0 ? Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length) : 0

  return (
    <div className="rounded-lg border border-border-default bg-surface-1 p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-primary">
          {activeUploadCount > 0 ? `正在上传 ${activeUploadCount} 个文件` : '上传完成'}
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-text-tertiary hover:text-text-secondary"
          title="清除已完成"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden mb-3">
        <div
          data-testid="progress-fill"
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${totalProgress}%` }}
        />
      </div>

      <ul className="space-y-1">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-2 text-xs">
            {task.status === 'failed' ? (
              <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
            ) : task.status === 'completed' ? (
              <span className="text-green-500 shrink-0">&#10003;</span>
            ) : (
              <span className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin shrink-0" />
            )}
            <span
              className={`flex-1 truncate ${task.status === 'failed' ? 'text-red-600' : 'text-text-primary'}`}
            >
              {task.fileName}
            </span>
            {task.status === 'failed' && (
              <>
                <span className="text-red-500">上传失败</span>
                <button
                  type="button"
                  onClick={() => onRetry(task.id)}
                  className="text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                  title="重试上传"
                >
                  <RefreshCw className="h-3 w-3" />
                  重试
                </button>
              </>
            )}
            {task.status === 'completed' && <span className="text-green-500">完成</span>}
            {task.status === 'uploading' && (
              <span className="text-text-tertiary">{task.progress}%</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
