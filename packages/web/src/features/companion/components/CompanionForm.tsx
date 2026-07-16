/**
 * 遗留 Dialog 表单：收敛为简表，主路径请用 CompanionFormPage 独立页。
 */
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createCompanion, updateCompanion } from '../services'
import type { CreateCompanionPayload, UpdateCompanionPayload } from '../types'

interface CompanionFormProps {
  open: boolean
  mode: 'create' | 'edit'
  companionId?: string
  initialData?: Partial<CreateCompanionPayload>
  onSuccess: () => void
  onCancel: () => void
}

export function CompanionForm({
  open,
  mode,
  companionId,
  initialData,
  onSuccess,
  onCancel,
}: CompanionFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [personality, setPersonality] = useState('')
  const [openingMessage, setOpeningMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name ?? '')
      setDescription(initialData.description ?? '')
      setPersonality(initialData.personality ?? '')
      setOpeningMessage(initialData.openingMessage ?? '')
    } else if (open) {
      setName('')
      setDescription('')
      setPersonality('')
      setOpeningMessage('')
    }
  }, [open, initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !description.trim() || !personality.trim()) {
      toast.error('请填写名称、角色说明与性格')
      return
    }

    const payload: CreateCompanionPayload = {
      name: name.trim(),
      description: description.trim(),
      personality: personality.trim(),
      openingMessage: openingMessage.trim() || undefined,
    }

    setLoading(true)
    try {
      if (mode === 'edit' && companionId) {
        await updateCompanion(companionId, payload as UpdateCompanionPayload).send()
        toast.success('更新成功')
      } else {
        await createCompanion(payload).send()
        toast.success('创建成功')
      }
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新建伴侣' : '编辑伴侣'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">名称 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：小助手"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">角色说明 *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="伴侣的角色说明"
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="personality">性格与互动 *</Label>
            <Textarea
              id="personality"
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="性格、说话方式"
              rows={2}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="openingMessage">开场白</Label>
            <Textarea
              id="openingMessage"
              value={openingMessage}
              onChange={(e) => setOpeningMessage(e.target.value)}
              placeholder="可选"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '保存中...' : mode === 'create' ? '创建' : '保存'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
