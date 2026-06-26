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
  const [headline, setHeadline] = useState('')
  const [description, setDescription] = useState('')
  const [personality, setPersonality] = useState('')
  const [tone, setTone] = useState('')
  const [boundaries, setBoundaries] = useState('')
  const [guardrailsPrompt, setGuardrailsPrompt] = useState('')
  const [defaultPrompt, setDefaultPrompt] = useState('')
  const [backgroundStory, setBackgroundStory] = useState('')
  const [openingMessage, setOpeningMessage] = useState('')
  const [avatarKey, setAvatarKey] = useState('')
  const [visibility, setVisibility] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name ?? '')
      setHeadline(initialData.headline ?? '')
      setDescription(initialData.description ?? '')
      setPersonality(initialData.personality ?? '')
      setTone(initialData.tone ?? '')
      setBoundaries(initialData.boundaries ?? '')
      setGuardrailsPrompt(initialData.guardrailsPrompt ?? '')
      setDefaultPrompt(initialData.defaultPrompt ?? '')
      setBackgroundStory(initialData.backgroundStory ?? '')
      setOpeningMessage(initialData.openingMessage ?? '')
      setAvatarKey(initialData.avatarKey ?? '')
      setVisibility(initialData.visibility ?? '')
    } else if (open) {
      setName('')
      setHeadline('')
      setDescription('')
      setPersonality('')
      setTone('')
      setBoundaries('')
      setGuardrailsPrompt('')
      setDefaultPrompt('')
      setBackgroundStory('')
      setOpeningMessage('')
      setAvatarKey('')
      setVisibility('')
    }
  }, [open, initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('请输入伴侣名称')
      return
    }

    const payload: CreateCompanionPayload = {
      name: name.trim(),
      headline: headline.trim() || undefined,
      description: description.trim() || undefined,
      personality: personality.trim() || undefined,
      tone: tone.trim() || undefined,
      boundaries: boundaries.trim() || undefined,
      guardrailsPrompt: guardrailsPrompt.trim() || undefined,
      defaultPrompt: defaultPrompt.trim() || undefined,
      backgroundStory: backgroundStory.trim() || undefined,
      openingMessage: openingMessage.trim() || undefined,
      avatarKey: avatarKey.trim() || undefined,
      visibility: visibility.trim() || undefined,
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
            <Label htmlFor="headline">副标题</Label>
            <Input
              id="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="简短描述，展示在卡片上"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">详细描述</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="伴侣的详细描述"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="personality">性格</Label>
            <Input
              id="personality"
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="例如：友善、幽默、专业"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tone">语气风格</Label>
            <Input
              id="tone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="例如：亲切、正式、活泼"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="boundaries">边界设定</Label>
            <Textarea
              id="boundaries"
              value={boundaries}
              onChange={(e) => setBoundaries(e.target.value)}
              placeholder="设定伴侣的行为边界"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guardrailsPrompt">安全提示词</Label>
            <Textarea
              id="guardrailsPrompt"
              value={guardrailsPrompt}
              onChange={(e) => setGuardrailsPrompt(e.target.value)}
              placeholder="注入的安全约束提示词"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultPrompt">默认提示词</Label>
            <Textarea
              id="defaultPrompt"
              value={defaultPrompt}
              onChange={(e) => setDefaultPrompt(e.target.value)}
              placeholder="每次对话默认注入的系统提示词"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="backgroundStory">背景故事</Label>
            <Textarea
              id="backgroundStory"
              value={backgroundStory}
              onChange={(e) => setBackgroundStory(e.target.value)}
              placeholder="伴侣的背景故事，用于增强角色感"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="openingMessage">开场白</Label>
            <Textarea
              id="openingMessage"
              value={openingMessage}
              onChange={(e) => setOpeningMessage(e.target.value)}
              placeholder="用户首次打开聊天时的欢迎语"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatarKey">头像文件 Key</Label>
            <Input
              id="avatarKey"
              value={avatarKey}
              onChange={(e) => setAvatarKey(e.target.value)}
              placeholder="上传头像后得到的文件 key"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visibility">可见性</Label>
            <Input
              id="visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              placeholder="例如：public / private"
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
