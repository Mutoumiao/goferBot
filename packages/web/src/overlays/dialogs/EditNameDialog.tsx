import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface EditNameDialogProps {
  currentName: string
  onClose?: (result?: unknown) => void
  onConfirm?: (name: string) => void | Promise<void>
}

export default function EditNameDialog({ currentName, onClose, onConfirm }: EditNameDialogProps) {
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError('昵称不能为空')
      return
    }
    if (trimmed.length > 50) {
      setError('昵称不能超过 50 个字符')
      return
    }
    if (trimmed === currentName) {
      onClose?.()
      return
    }

    setIsSubmitting(true)
    try {
      await onConfirm?.(trimmed)
      onClose?.(trimmed)
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message
      setError(message || '更新失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose?.()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>修改用户名</DialogTitle>
          <DialogDescription>请输入新的用户名</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name-input">用户名</Label>
            <Input
              id="name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入昵称"
              maxLength={50}
              autoFocus
              aria-invalid={!!error}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose?.()}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '保存中...' : '保存'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
