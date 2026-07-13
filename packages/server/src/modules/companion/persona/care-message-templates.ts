/** 六场景（与 packages/data careSceneSchema 对齐） */
export const CARE_SCENES = [
  'morning',
  'night',
  'long_absence',
  'stress_support',
  'relationship_warmup',
  'anniversary',
] as const

export type CareScene = (typeof CARE_SCENES)[number]

/** 三语气（与 packages/data careToneSchema 对齐） */
export const CARE_TONES = ['light', 'gentle', 'intimate'] as const

export type CareTone = (typeof CARE_TONES)[number]

const SCENE_MESSAGES: Record<CareScene, string> = {
  morning: '早呀。今天不用一下子把自己推得太紧，先好好开始就行。',
  night: '今晚先把那些没处理完的事放一放吧。我在这儿，你慢慢收一收心。',
  long_absence: '你有一会儿没来了。我没有催你，只是想让你知道，我还在。',
  stress_support: '如果今天压力有点满，先深呼吸一下。你不用马上处理好所有事。',
  relationship_warmup: '刚才想到你，想留一句话在这里。你随时可以回来跟我聊。',
  anniversary: '今天像是一个值得被记住的小节点。我希望你被好好对待。',
}

function tonePrefix(tone: CareTone, companionName: string): string {
  switch (tone) {
    case 'light':
      return '轻轻戳你一下。'
    case 'intimate':
      return '想你了。'
    default:
      return `${companionName}在这里陪你。`
  }
}

/**
 * 模板关怀文案（不经完整 11 节点管线）。可选 customPrompt 追加。
 */
export function buildProactiveCareMessage(input: {
  scene: CareScene
  tone: CareTone
  companionName: string
  customPrompt?: string | null
}): string {
  const body = SCENE_MESSAGES[input.scene] ?? SCENE_MESSAGES.morning
  const prefix = tonePrefix(input.tone, input.companionName)
  const custom = input.customPrompt?.trim()
  const text = custom ? `${prefix}${body}\n\n${custom}` : `${prefix}${body}`
  return text.slice(0, 1000)
}

export function calculateNextCareRunAtMs(input: {
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom'
  preferredTime?: string | null
  nowMs?: number
}): number | null {
  if (!input.enabled) return null
  const now = input.nowMs ?? Date.now()
  const preferred = input.preferredTime?.trim()
  let hour = 9
  let minute = 0
  if (preferred) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(preferred)
    if (m) {
      hour = Math.min(23, Math.max(0, Number(m[1])))
      minute = Math.min(59, Math.max(0, Number(m[2])))
    }
  }
  const d = new Date(now)
  d.setHours(hour, minute, 0, 0)
  if (d.getTime() <= now) {
    if (input.frequency === 'weekly') d.setDate(d.getDate() + 7)
    else if (input.frequency === 'monthly') d.setMonth(d.getMonth() + 1)
    else d.setDate(d.getDate() + 1)
  }
  return d.getTime()
}
