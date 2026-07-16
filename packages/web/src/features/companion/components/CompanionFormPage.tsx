/**
 * Web 自定义简表：name / description / personality 必填 + 可选开场白与头像
 * 不收集 boundaries / guardrails / defaultPrompt 预览
 */
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { readImageDimensions, validateCompanionAvatarClient } from '../persona/avatar-validation'
import { createCompanion, getCompanion, updateCompanion, uploadCompanionAvatar } from '../services'
import type { CreateCompanionPayload } from '../types'

interface CompanionFormPageProps {
  mode: 'create' | 'edit'
  companionId?: string
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

export function CompanionFormPage({ mode, companionId }: CompanionFormPageProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [personality, setPersonality] = useState('')
  const [openingMessage, setOpeningMessage] = useState('')
  const [avatarKey, setAvatarKey] = useState('')
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)

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
          navigate({ to: '/companions' })
          return
        }
        setName(c.name ?? '')
        setDescription(c.description ?? '')
        setPersonality(c.personality ?? '')
        setOpeningMessage(c.openingMessage ?? '')
        setAvatarKey(c.avatarKey ?? '')
        if (c.avatarUrl) setAvatarPreviewUrl(c.avatarUrl)
        else if (c.avatarKey) setAvatarPreviewUrl(`/api/files/${c.avatarKey}`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '加载失败')
        navigate({ to: '/companions' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode, companionId, navigate])

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
      if (mode === 'edit' && companionId) {
        await updateCompanion(companionId, payload).send()
        toast.success('保存成功')
        navigate({ to: '/companions/$companionId/chat', params: { companionId } })
      } else {
        const created = await createCompanion(payload).send()
        toast.success('创建成功')
        navigate({
          to: '/companions/$companionId/chat',
          params: { companionId: created.id },
        })
      }
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/companions' })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">{mode === 'create' ? '新建伴侣' : '编辑伴侣'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-4 rounded-xl border p-4">
          <h2 className="font-medium">角色形象</h2>
          <div className="flex items-start gap-4">
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-2xl font-medium"
              style={{
                backgroundImage: avatarPreviewUrl ? `url(${avatarPreviewUrl})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {!avatarPreviewUrl && (name.charAt(0) || '?')}
            </div>
            <div className="space-y-2 flex-1">
              <Label htmlFor="avatar-file">头像（可选）</Label>
              <Input
                id="avatar-file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploading}
                onChange={(e) => void handleAvatarChange(e.target.files?.[0] ?? null)}
              />
              {uploading && <p className="text-xs text-muted-foreground">上传中…</p>}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border p-4">
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
              placeholder="用几句话介绍这个角色"
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
              placeholder="性格、说话方式、相处风格"
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
              placeholder="首次进入聊天时的欢迎语"
            />
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: '/companions' })}>
            取消
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? '保存中…' : mode === 'create' ? '创建并聊天' : '保存'}
          </Button>
        </div>
      </form>
    </div>
  )
}
