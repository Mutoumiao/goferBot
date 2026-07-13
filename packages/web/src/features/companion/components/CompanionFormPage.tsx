/**
 * 独立创建/编辑页（分段人设表单 + defaultPrompt 预览 + 头像上传）
 */
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ImagePlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { readImageDimensions, validateCompanionAvatarClient } from '../persona/avatar-validation'
import { buildDefaultAgentPrompt } from '../persona/build-default-agent-prompt'
import { createCompanion, getCompanion, updateCompanion, uploadCompanionAvatar } from '../services'
import type { CompanionStatus, CreateCompanionPayload } from '../types'

interface CompanionFormPageProps {
  mode: 'create' | 'edit'
  companionId?: string
}

export function CompanionFormPage({ mode, companionId }: CompanionFormPageProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [name, setName] = useState('')
  const [headline, setHeadline] = useState('')
  const [description, setDescription] = useState('')
  const [personality, setPersonality] = useState('')
  const [tone, setTone] = useState('')
  const [boundaries, setBoundaries] = useState('')
  const [guardrailsPrompt, setGuardrailsPrompt] = useState('')
  const [backgroundStory, setBackgroundStory] = useState('')
  const [openingMessage, setOpeningMessage] = useState('')
  const [avatarKey, setAvatarKey] = useState('')
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [visibility, setVisibility] = useState('private')
  const [status, setStatus] = useState<CompanionStatus>('draft')

  useEffect(() => {
    if (mode !== 'edit' || !companionId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const c = await getCompanion(companionId).send()
        if (cancelled) return
        setName(c.name ?? '')
        setHeadline(c.headline ?? '')
        setDescription(c.description ?? '')
        setPersonality(c.personality ?? '')
        setTone(c.tone ?? '')
        setBoundaries(c.boundaries ?? '')
        setGuardrailsPrompt(c.guardrailsPrompt ?? '')
        setBackgroundStory(c.backgroundStory ?? '')
        setOpeningMessage(c.openingMessage ?? '')
        setAvatarKey(c.avatarKey ?? '')
        setVisibility(c.visibility ?? 'private')
        setStatus(c.status)
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

  const previewPrompt = useMemo(
    () =>
      buildDefaultAgentPrompt({
        name,
        headline,
        description,
        backgroundStory,
        personality,
        tone,
        boundaries,
        guardrailsPrompt,
        openingMessage,
      }),
    [
      name,
      headline,
      description,
      backgroundStory,
      personality,
      tone,
      boundaries,
      guardrailsPrompt,
      openingMessage,
    ],
  )

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
      backgroundStory: backgroundStory.trim() || undefined,
      openingMessage: openingMessage.trim() || undefined,
      avatarKey: avatarKey.trim() || undefined,
      visibility: visibility.trim() || undefined,
    }

    setSaving(true)
    try {
      if (mode === 'edit' && companionId) {
        await updateCompanion(companionId, payload).send()
        // status 单独 patch（若变更）
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
      toast.error(err instanceof Error ? err.message : '保存失败')
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
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/companions' })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">{mode === 'create' ? '新建伴侣' : '编辑伴侣'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <section className="space-y-4 rounded-xl border p-4">
            <h2 className="font-medium">角色形象</h2>
            <div className="flex items-start gap-4">
              <div
                className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted text-2xl font-medium"
                style={{
                  backgroundImage: avatarPreviewUrl ? `url(${avatarPreviewUrl})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {!avatarPreviewUrl && (name.charAt(0) || '?')}
              </div>
              <div className="space-y-2">
                <Label htmlFor="avatar-file">上传头像（PNG/JPEG/WebP，约 2:3，最短边≥720）</Label>
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
            <h2 className="font-medium">基础信息</h2>
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
              <Label htmlFor="headline">一句话设定</Label>
              <Input
                id="headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="温柔稳定的长期聊天伴侣"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">角色说明</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-xl border p-4">
            <h2 className="font-medium">人物与互动</h2>
            <div className="space-y-2">
              <Label htmlFor="backgroundStory">人物故事</Label>
              <Textarea
                id="backgroundStory"
                value={backgroundStory}
                onChange={(e) => setBackgroundStory(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="personality">性格与互动</Label>
              <Textarea
                id="personality"
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tone">语气风格</Label>
              <Textarea id="tone" value={tone} onChange={(e) => setTone(e.target.value)} rows={2} />
            </div>
          </section>

          <section className="space-y-4 rounded-xl border p-4">
            <h2 className="font-medium">边界与开场</h2>
            <div className="space-y-2">
              <Label htmlFor="boundaries">边界设定</Label>
              <Textarea
                id="boundaries"
                value={boundaries}
                onChange={(e) => setBoundaries(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guardrailsPrompt">安全提示词</Label>
              <Textarea
                id="guardrailsPrompt"
                value={guardrailsPrompt}
                onChange={(e) => setGuardrailsPrompt(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="openingMessage">默认开场白</Label>
              <Textarea
                id="openingMessage"
                value={openingMessage}
                onChange={(e) => setOpeningMessage(e.target.value)}
                rows={2}
                placeholder="空会话时展示"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visibility">可见性</Label>
              <Input
                id="visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                placeholder="private / public"
              />
            </div>
          </section>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate({ to: '/companions' })}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? '保存中…' : mode === 'create' ? '创建' : '保存'}
            </Button>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <ImagePlus className="h-4 w-4" />
              预览
            </div>
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground"
                style={{
                  backgroundImage: avatarPreviewUrl ? `url(${avatarPreviewUrl})` : undefined,
                  backgroundSize: 'cover',
                }}
              >
                {!avatarPreviewUrl && (name.charAt(0) || '?')}
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium">{name || '未命名角色'}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {headline || '一句话设定'}
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">状态：{status}</p>
          </div>
          <div className="rounded-xl border p-4">
            <h3 className="mb-2 text-sm font-medium">defaultPrompt 预览</h3>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-relaxed">
              {previewPrompt || '填写人设后将生成预览'}
            </pre>
          </div>
        </aside>
      </form>
    </div>
  )
}
