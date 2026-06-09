import { useState } from 'react'
import { deleteKb } from '@/api/kb'
import { Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
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
import { Button } from '@/components/ui/button'

interface DeleteKbDialogProps {
  kbId: string
  kbName: string
  onClose?: (result?: unknown) => void
  onConfirm?: () => void | Promise<void>
}

export default function DeleteKbDialog({
  kbId,
  kbName,
  onClose,
  onConfirm,
}: DeleteKbDialogProps) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      await deleteKb(kbId).send()
      await onConfirm?.()
      onClose?.(true)
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 404) {
        toast.error('知识库不存在或已被删除', { duration: 3000 })
        onClose?.('refresh')
        return
      }
      if (status === 403) {
        toast.error('权限不足，无法删除知识库', {
          description: '请联系管理员获取相应权限',
          duration: 3000,
        })
        onClose?.(false)
        return
      }
      toast.error('网络连接失败，请检查网络后重试', { duration: 3000 })
      onClose?.(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={() => onClose?.(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            删除知识库
          </AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除知识库「<span className="font-medium text-foreground">{kbName}</span>」吗？此操作不可撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading} onClick={() => onClose?.(false)}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              disabled={loading}
              onClick={handleDelete}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? '删除中...' : '删除'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
