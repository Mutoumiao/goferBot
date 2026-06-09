import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'

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
    <AlertDialog open onOpenChange={() => onClose('cancel')}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除会话</AlertDialogTitle>
          <AlertDialogDescription>
            确定删除「{sessionTitle}」？此操作不可撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            data-testid="delete-cancel-btn"
            disabled={loading}
            onClick={() => onClose('cancel')}
          >
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="delete-confirm-btn"
            disabled={loading}
            onClick={() => onClose('confirm')}
          >
            {loading ? '删除中...' : '删除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
