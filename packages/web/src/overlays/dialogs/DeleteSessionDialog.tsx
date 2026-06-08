import { cn } from '@/utils/cn'

interface DeleteSessionDialogProps {
  sessionTitle: string
  loading?: boolean
  onClose: (result: 'confirm' | 'cancel') => void
}

export function DeleteSessionDialog({
  sessionTitle,
  loading = false,
  onClose,
}: DeleteSessionDialogProps) {
  return (
    <div className="w-full max-w-sm p-6">
      <h3 className="text-lg font-semibold text-text-primary">删除会话</h3>
      <p className="mt-2 text-sm text-text-secondary">
        确定删除「{sessionTitle}」？此操作不可撤销。
      </p>

      <div className="mt-6 flex justify-end gap-2">
        <button
          data-testid="delete-cancel-btn"
          onClick={() => onClose('cancel')}
          disabled={loading}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium',
            'border border-border-default text-text-primary hover:bg-surface-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          取消
        </button>
        <button
          data-testid="delete-confirm-btn"
          onClick={() => onClose('confirm')}
          disabled={loading}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium text-white',
            'bg-danger-600 hover:bg-danger-700',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {loading ? '删除中...' : '删除'}
        </button>
      </div>
    </div>
  )
}
