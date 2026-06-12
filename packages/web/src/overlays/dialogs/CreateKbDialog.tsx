import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createKbRequestSchema } from '@goferbot/data'
import type { CreateKbRequest } from '@goferbot/data'
import { createKb } from '@/api/KnowledgeBase'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface CreateKbDialogProps {
  onClose?: (result?: unknown) => void
  onConfirm?: () => void | Promise<void>
  /** 编辑模式：预填数据 */
  initialData?: { id?: string; name?: string; description?: string }
  /** 编辑模式：保存回调（调用 updateKb），不传则走 createKb */
  onSave?: (id: string, data: CreateKbRequest) => Promise<unknown>
}

type FormData = CreateKbRequest

export default function CreateKbDialog({ onClose, onConfirm, initialData, onSave }: CreateKbDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditMode = !!initialData?.id && !!onSave

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(createKbRequestSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      description: initialData?.description ?? '',
    },
  })

  const onSubmit = async (data: FormData) => {
    setServerError(null)
    setIsSubmitting(true)
    try {
      if (isEditMode && onSave && initialData?.id) {
        await onSave(initialData.id, data)
      } else {
        await createKb(data).send()
      }
      await onConfirm?.()
      onClose?.(true)
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      const message = (err as { message?: string })?.message
      if (status === 409) {
        setServerError('该名称已存在')
      } else if (status === 403) {
        toast.error('权限不足，无法创建知识库', {
          description: '请联系管理员获取相应权限',
          duration: 3000,
        })
        onClose?.(false)
      } else {
        setServerError(message || '网络连接失败，请检查网络后重试')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose?.(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? '编辑知识库' : '创建知识库'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? '修改知识库的名称和描述信息。' : '填写知识库的名称和描述，创建一个新的知识库。'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* 名称 */}
          <div className="space-y-1.5">
            <Label htmlFor="kb-name">名称</Label>
            <Input
              id="kb-name"
              {...register('name')}
              placeholder="知识库名称"
              aria-invalid={!!errors.name || !!serverError}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            {serverError && !errors.name && <p className="text-xs text-destructive">{serverError}</p>}
          </div>

          {/* 描述 */}
          <div className="space-y-1.5">
            <Label htmlFor="kb-desc">
              描述
              <span className="text-muted-foreground ml-1">（可选）</span>
            </Label>
            <Textarea id="kb-desc" {...register('description')} placeholder="描述（可选）" rows={3} />
          </div>

          {/* 按钮 */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onClose?.(false)} disabled={isSubmitting}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? (isEditMode ? '保存中...' : '创建中...') : isEditMode ? '保存' : '创建'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
