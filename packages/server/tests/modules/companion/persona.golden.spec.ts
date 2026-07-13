/**
 * UT-PS-prompt-build / UT-AV-validate / UT-CA-enum / care template 黄金测试
 */
import {
  buildDefaultAgentPrompt,
  careSceneSchema,
  careToneSchema,
} from '@goferbot/data/schemas'
import { describe, expect, it } from 'vitest'
import {
  COMPANION_AVATAR_MAX_BYTES,
  COMPANION_AVATAR_MIN_SHORT_SIDE,
  COMPANION_AVATAR_RATIO_TOLERANCE,
  COMPANION_AVATAR_TARGET_RATIO,
  validateCompanionAvatarMeta,
} from '@/modules/companion/persona/avatar-validation.js'
import {
  CARE_SCENES,
  CARE_TONES,
  buildProactiveCareMessage,
  calculateNextCareRunAtMs,
  type CareScene,
  type CareTone,
} from '@/modules/companion/persona/care-message-templates.js'

describe('UT-PS-prompt-build buildDefaultAgentPrompt', () => {
  it('拼多节并省略空节', () => {
    const prompt = buildDefaultAgentPrompt({
      name: 'Luna',
      headline: '温柔伴侣',
      personality: '稳定、温柔',
      tone: '自然口语',
      boundaries: '',
      guardrailsPrompt: '不制造焦虑',
      openingMessage: '我在。',
    })
    expect(prompt).toContain('「Luna」')
    expect(prompt).toContain('## 一句话设定')
    expect(prompt).toContain('温柔伴侣')
    expect(prompt).toContain('## 性格与互动方式')
    expect(prompt).toContain('## 边界与安全规则')
    expect(prompt).toContain('不制造焦虑')
    expect(prompt).not.toContain('## 人物故事背景')
    expect(prompt).toContain('## 回复要求')
  })

  it('仅有 name 时仍有角色声明', () => {
    const prompt = buildDefaultAgentPrompt({ name: '小助' })
    expect(prompt).toContain('小助')
  })
})

describe('UT-AV-validate companion avatar', () => {
  it('拒绝超限大小', () => {
    const r = validateCompanionAvatarMeta({
      mimeType: 'image/png',
      sizeBytes: COMPANION_AVATAR_MAX_BYTES + 1,
      width: 720,
      height: 1080,
    })
    expect(r.ok).toBe(false)
  })

  it('拒绝最短边不足', () => {
    const r = validateCompanionAvatarMeta({
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
      width: 600,
      height: 900,
    })
    expect(r.ok).toBe(false)
  })

  it('接受约 2:3 比例与最小边', () => {
    const r = validateCompanionAvatarMeta({
      mimeType: 'image/webp',
      sizeBytes: 1000,
      width: COMPANION_AVATAR_MIN_SHORT_SIDE,
      height: Math.round(COMPANION_AVATAR_MIN_SHORT_SIDE / COMPANION_AVATAR_TARGET_RATIO),
    })
    expect(r.ok).toBe(true)
  })

  it('容差常量约为 5%', () => {
    expect(COMPANION_AVATAR_RATIO_TOLERANCE).toBe(0.05)
  })
})

describe('care templates', () => {
  it('生成场景文案并截断', () => {
    const msg = buildProactiveCareMessage({
      scene: 'morning',
      tone: 'gentle',
      companionName: 'Luna',
    })
    expect(msg).toContain('Luna')
    expect(msg.length).toBeLessThanOrEqual(1000)
  })

  it('disabled 时 nextRunAt 为 null', () => {
    expect(
      calculateNextCareRunAtMs({ enabled: false, frequency: 'daily', preferredTime: '09:00' }),
    ).toBeNull()
  })
})

describe('UT-CA-enum: 六场景 × 三语气', () => {
  it('CARE_SCENES 为 6、CARE_TONES 为 3，且与 data Zod 枚举一致', () => {
    expect(CARE_SCENES).toHaveLength(6)
    expect(CARE_TONES).toHaveLength(3)
    for (const scene of CARE_SCENES) {
      expect(careSceneSchema.safeParse(scene).success).toBe(true)
    }
    for (const tone of CARE_TONES) {
      expect(careToneSchema.safeParse(tone).success).toBe(true)
    }
    // Zod 枚举 options 与模板常量同集合（防止一端增删漏同步）
    expect([...careSceneSchema.options].sort()).toEqual([...CARE_SCENES].sort())
    expect([...careToneSchema.options].sort()).toEqual([...CARE_TONES].sort())
  })

  it('18 组合均产出非空文案，且含对应场景正文与语气前缀特征', () => {
    const sceneBodyHints: Record<CareScene, string> = {
      morning: '早呀',
      night: '今晚',
      long_absence: '没来',
      stress_support: '压力',
      relationship_warmup: '想到你',
      anniversary: '节点',
    }
    const toneHints: Record<CareTone, string | RegExp> = {
      light: '轻轻戳你一下',
      intimate: '想你了',
      gentle: '在这里陪你', // gentle 前缀含 companionName
    }

    const seen = new Set<string>()
    for (const scene of CARE_SCENES) {
      for (const tone of CARE_TONES) {
        const msg = buildProactiveCareMessage({
          scene,
          tone,
          companionName: '小助',
        })
        expect(msg.length, `${scene}×${tone}`).toBeGreaterThan(10)
        expect(msg.length).toBeLessThanOrEqual(1000)
        expect(msg).toContain(sceneBodyHints[scene])
        const hint = toneHints[tone]
        if (typeof hint === 'string') {
          expect(msg).toContain(hint)
        }
        if (tone === 'gentle') {
          expect(msg).toContain('小助')
        }
        seen.add(`${scene}|${tone}|${msg}`)
      }
    }
    // 6×3=18；组合键唯一
    expect(seen.size).toBe(18)
  })

  it('customPrompt 追加且总长截断至 1000', () => {
    const long = 'X'.repeat(2000)
    const msg = buildProactiveCareMessage({
      scene: 'night',
      tone: 'light',
      companionName: 'A',
      customPrompt: long,
    })
    expect(msg.length).toBe(1000)
    expect(msg).toContain('轻轻戳你一下')
  })
})
