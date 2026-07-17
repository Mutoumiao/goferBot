/**
 * 新建 / 编辑伴侣 — 表单档弹层。
 */
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { openDialog } from '@/overlays/services/overlay-service'
import { readImageDimensions, validateCompanionAvatarClient } from '../persona/avatar-validation'
import { createCompanion, getCompanion, updateCompanion, uploadCompanionAvatar } from '../services'
import type { Companion, CreateCompanionPayload } from '../types'
import { CompanionPanelShell } from './companion-panel-shell'
import type { OverlayConfirmResult } from './overlay-confirm-dialog'
import OverlayConfirmDialog from './overlay-confirm-dialog'

export type CompanionFormDialogProps = {
  mode: 'create' | 'edit'
  companionId?: string
  onSuccess?: (companion: Companion) => void | Promise<void>
  onClose?: (result?: unknown) => void
}

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { message?: string; code?: string; data?: { message?: string; code?: string } }
    if (e.data?.code === 'COMPANION_LIMIT_EXCEEDED' || e.code === 'COMPANION_LIMIT_EXCEEDED') {
      return e.data?.message || e.message || '自定义伴侣数量已达上限'
    }
    if (e.data?.message) return e.data.message
    if (e.message) return e.message
  }
  return '保存失败'
}

export default function CompanionFormDialog({
  mode,
  companionId,
  onSuccess,
  onClose,
}: CompanionFormDialogProps) {
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [personality, setPersonality] = useState('')
  const [openingMessage, setOpeningMessage] = useState('')
  const [avatarKey, setAvatarKey] = useState('')
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)

  const baselineRef = useRef({
    name: '',
    description: '',
    personality: '',
    openingMessage: '',
    avatarKey: '',
  })

  useEffect(() => {
    if (mode !== 'edit' || !companionId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const c = await getCompanion(companionId).send()
        if (cancelled) return
        if (c.source === 'system') {
          toast.error('官方伴侣不可编辑')
          onClose?.(false)
          return
        }
        const next = {
          name: c.name ?? '',
          description: c.description ?? '',
          personality: c.personality ?? '',
          openingMessage: c.openingMessage ?? '',
          avatarKey: c.avatarKey ?? '',
        }
        setName(next.name)
        setDescription(next.description)
        setPersonality(next.personality)
        setOpeningMessage(next.openingMessage)
        setAvatarKey(next.avatarKey)
        baselineRef.current = next
        if (c.avatarUrl) setAvatarPreviewUrl(c.avatarUrl)
        else if (c.avatarKey) setAvatarPreviewUrl(`/api/files/${c.avatarKey}`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '加载失败')
        onClose?.(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode, companionId, onClose])

  const isDirty = () => {
    const b = baselineRef.current
    return (
      name !== b.name ||
      description !== b.description ||
      personality !== b.personality ||
      openingMessage !== b.openingMessage ||
      avatarKey !== b.avatarKey
    )
  }

  const handleRequestClose = async () => {
    if (!isDirty()) return true
    const result = await openDialog<OverlayConfirmResult>(OverlayConfirmDialog, {
      title: '放弃未保存的更改？',
      description: '关闭后已填写内容将丢失。',
      confirmText: '放弃',
      cancelText: '继续编辑',
    })
    return result === 'confirm'
  }

  const handleAvatarChange = async (file: File | null) => {
    if (!file) return
    try {
      const dims = await readImageDimensions(file)
      const check = validateCompanionAvatarClient({
        mimeType: file.type,
        sizeBytes: file.size,
        width: dims.width,
        height: dims.height,
      })
      if (!check.ok) {
        toast.error(check.message)
        return
      }
      setUploading(true)
      const res = await uploadCompanionAvatar(file).send()
      setAvatarKey(res.avatarKey)
      setAvatarPreviewUrl(res.avatarUrl ?? URL.createObjectURL(file))
      toast.success('头像已上传')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '头像上传失败')
    } finally {
      setUploading(false)
    }
  }

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
      avatarKey: avatarKey.trim() || undefined,
    }

    setSaving(true)
    try {
      let companion: Companion
      if (mode === 'edit' && companionId) {
        companion = await updateCompanion(companionId, payload).send()
        toast.success('保存成功')
      } else {
        companion = await createCompanion(payload).send()
        toast.success('创建成功')
      }
      await onSuccess?.(companion)
      onClose?.(true)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <CompanionPanelShell
      tier="form"
      title={mode === 'create' ? '新建伴侣' : '编辑伴侣'}
      description="填写简要人设后即可开始对话"
      onClose={onClose}
      onRequestClose={handleRequestClose}
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <section className="space-y-3">
            <h2 className="text-sm font-medium">角色形象</h2>
            <div className="flex items-start gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-xl font-medium"
                style={{
                  backgroundImage: avatarPreviewUrl ? `url(${avatarPreviewUrl})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {!avatarPreviewUrl && (name.charAt(0) || '?')}
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="avatar-file">头像（可选）</Label>
                <Input
                  id="avatar-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploading}
                  onChange={(e) => void handleAvatarChange(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          </section>

          <div className="space-y-2">
            <Label htmlFor="name">名称 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：星野 Luna"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">角色说明 *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              rows={3}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="openingMessage">开场白（可选）</Label>
            <Textarea
              id="openingMessage"
              value={openingMessage}
              onChange={(e) => setOpeningMessage(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleRequestClose().then((ok) => ok && onClose?.(false))}
            >
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? '保存中…' : mode === 'create' ? '创建并聊天' : '保存'}
            </Button>
          </div>
        </form>
      )}
    </CompanionPanelShell>
  )
}
