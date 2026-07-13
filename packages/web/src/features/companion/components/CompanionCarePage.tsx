import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Heart, MessageCircle, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { generateCareEvent, getCarePlan, getCompanion, updateCarePlan } from '../services'
import {
  CARE_SCENE_LABELS,
  CARE_TONE_LABELS,
  type CareFrequency,
  type CarePlan,
  type CareScene,
  type CareTone,
  type Companion,
} from '../types'
import { CompanionStatusTag } from './CompanionStatusTag'

const ALL_SCENES = Object.keys(CARE_SCENE_LABELS) as CareScene[]
const ALL_TONES = Object.keys(CARE_TONE_LABELS) as CareTone[]
const FREQUENCIES: CareFrequency[] = ['daily', 'weekly', 'monthly', 'custom']

interface CompanionCarePageProps {
  companionId: string
}

export function CompanionCarePage({ companionId }: CompanionCarePageProps) {
  const navigate = useNavigate()
  const [companion, setCompanion] = useState<Companion | null>(null)
  const [plan, setPlan] = useState<CarePlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateScene, setGenerateScene] = useState<CareScene>('morning')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, p] = await Promise.all([
        getCompanion(companionId).send(),
        getCarePlan(companionId).send(),
      ])
      setCompanion(c)
      setPlan(p)
      setGenerateScene(p.scenes?.[0] ?? 'morning')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [companionId])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    if (!plan) return
    setSaving(true)
    try {
      const saved = await updateCarePlan(companionId, {
        enabled: plan.enabled,
        frequency: plan.frequency,
        preferredTime: plan.preferredTime,
        scenes: plan.scenes,
        tone: plan.tone,
        customPrompt: plan.customPrompt,
      }).send()
      setPlan(saved)
      toast.success('关怀计划已保存')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const event = await generateCareEvent(companionId, {
        scene: generateScene,
        tone: plan?.tone,
        customPrompt: plan?.customPrompt ?? undefined,
      }).send()
      toast.success('已生成关怀消息')
      navigate({
        to: '/companions/$companionId/chat',
        params: { companionId },
      })
      // 携带生成结果提示
      void event
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const toggleScene = (scene: CareScene) => {
    if (!plan) return
    const has = plan.scenes.includes(scene)
    const next = has ? plan.scenes.filter((s) => s !== scene) : [...plan.scenes, scene]
    if (next.length === 0) {
      toast.error('至少保留一个场景')
      return
    }
    setPlan({ ...plan, scenes: next })
  }

  if (loading || !plan) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: '/companions/$companionId/chat', params: { companionId } })}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-rose-500" />
            <h1 className="text-lg font-semibold truncate">
              {companion?.name ?? '伴侣'} · 主动关怀
            </h1>
            {companion && <CompanionStatusTag status={companion.status} />}
          </div>
          {plan.isDefault && (
            <p className="text-xs text-muted-foreground">当前为默认配置（尚未持久化）</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate({ to: '/companions/$companionId/chat', params: { companionId } })}
        >
          <MessageCircle className="h-4 w-4 mr-1" />
          对话
        </Button>
      </div>

      <div className="space-y-6">
        <section className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="enabled"
              checked={plan.enabled}
              onCheckedChange={(v) => setPlan({ ...plan, enabled: Boolean(v) })}
            />
            <Label htmlFor="enabled">启用关怀计划</Label>
          </div>
          <div className="space-y-2">
            <Label>频率</Label>
            <div className="flex flex-wrap gap-2">
              {FREQUENCIES.map((f) => (
                <Button
                  key={f}
                  type="button"
                  size="sm"
                  variant={plan.frequency === f ? 'default' : 'outline'}
                  onClick={() => setPlan({ ...plan, frequency: f })}
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferredTime">偏好时间（HH:mm，可选）</Label>
            <Input
              id="preferredTime"
              value={plan.preferredTime ?? ''}
              onChange={(e) => setPlan({ ...plan, preferredTime: e.target.value || null })}
              placeholder="09:00"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            nextRunAt 仅存储计算值，本版本无 Cron 自动投递。
          </p>
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <Label>场景（至少一项）</Label>
          <div className="grid grid-cols-2 gap-2">
            {ALL_SCENES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={plan.scenes.includes(s)}
                  onCheckedChange={() => toggleScene(s)}
                />
                {CARE_SCENE_LABELS[s]}
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <Label>语气</Label>
          <div className="flex flex-wrap gap-2">
            {ALL_TONES.map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant={plan.tone === t ? 'default' : 'outline'}
                onClick={() => setPlan({ ...plan, tone: t })}
              >
                {CARE_TONE_LABELS[t]}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="customPrompt">自定义补充（可选）</Label>
            <Textarea
              id="customPrompt"
              value={plan.customPrompt ?? ''}
              onChange={(e) => setPlan({ ...plan, customPrompt: e.target.value || null })}
              rows={2}
            />
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? '保存中…' : '保存计划'}
          </Button>
        </div>

        <section className="space-y-3 rounded-xl border border-dashed p-4">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4" />
            立即生成关怀消息
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_SCENES.map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={generateScene === s ? 'default' : 'outline'}
                onClick={() => setGenerateScene(s)}
              >
                {CARE_SCENE_LABELS[s]}
              </Button>
            ))}
          </div>
          <Button onClick={() => void handleGenerate()} disabled={generating}>
            {generating ? '生成中…' : '立即生成'}
          </Button>
          <p className="text-xs text-muted-foreground">
            将写入当前会话助手消息，并在聊天中可见（带关怀标记）。
          </p>
        </section>
      </div>
    </div>
  )
}
