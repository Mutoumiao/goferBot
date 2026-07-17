/**
 * 供 openDialog 使用的轻量确认框（Alert 风格 onClose）。
 */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export type OverlayConfirmResult = 'confirm' | 'cancel'

type OverlayConfirmDialogProps = {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  onClose?: (result?: OverlayConfirmResult) => void
}

export default function OverlayConfirmDialog({
  title,
  description,
  confirmText = '确定',
  cancelText = '取消',
  onClose,
}: OverlayConfirmDialogProps) {
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose?.('cancel')}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onClose?.('cancel')}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction onClick={() => onClose?.('confirm')}>{confirmText}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
