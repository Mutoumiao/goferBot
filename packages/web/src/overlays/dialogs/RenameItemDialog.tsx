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

interface RenameItemDialogProps {
  itemName: string
  isFolder: boolean
  onClose?: (result?: unknown) => void
  onConfirm?: (newName: string) => void | Promise<void>
}

export default function RenameItemDialog({
  itemName,
  isFolder,
  onClose,
  onConfirm,
}: RenameItemDialogProps) {
  const [name, setName] = useState(itemName)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError('名称不能为空')
      return
    }
    if (trimmed === itemName) {
      onClose?.(false)
      return
    }

    setIsSubmitting(true)
    try {
      await onConfirm?.(trimmed)
      onClose?.(true)
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      const message = (err as { message?: string })?.message
      if (status === 409) {
        setError('该名称已存在')
      } else {
        setError(message || '重命名失败')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose?.(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>重命名{isFolder ? '文件夹' : '文件'}</DialogTitle>
          <DialogDescription>为「{itemName}」输入新名称。</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rename-input">新名称</Label>
            <Input
              id="rename-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`请输入${isFolder ? '文件夹' : '文件'}名称`}
              autoFocus
              aria-invalid={!!error}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose?.(false)}
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
