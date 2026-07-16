import { describe, expect, it } from 'vitest'
import {
  COMPANION_DEFAULT_GUARDRAILS,
  resolvePersonaPrompt,
  resolveUserSafety,
} from '@goferbot/data/schemas'

describe('resolveUserSafety', () => {
  it('uses code fallback when global empty', () => {
    const s = resolveUserSafety({})
    expect(s.guardrailsPrompt).toBe(COMPANION_DEFAULT_GUARDRAILS)
  })

  it('prefers global boundaries/guardrails', () => {
    const s = resolveUserSafety({
      defaultBoundaries: '  不谈政治  ',
      defaultGuardrailsPrompt: '安全第一',
    })
    expect(s.boundaries).toBe('不谈政治')
    expect(s.guardrailsPrompt).toBe('安全第一')
  })
})

describe('resolvePersonaPrompt', () => {
  it('system uses row safety not global', () => {
    const prompt = resolvePersonaPrompt(
      {
        source: 'system',
        name: '官方',
        personality: '温柔',
        boundaries: '行内边界',
        guardrailsPrompt: '行内安全',
      },
      { defaultBoundaries: '全局边界', defaultGuardrailsPrompt: '全局安全' },
    )
    expect(prompt).toContain('行内边界')
    expect(prompt).toContain('行内安全')
    expect(prompt).not.toContain('全局边界')
  })

  it('user uses global safety and ignores stale row fields in merge', () => {
    const prompt = resolvePersonaPrompt(
      {
        source: 'user',
        name: '自定义',
        description: '角色说明',
        personality: '活泼',
        boundaries: '陈旧行内',
        guardrailsPrompt: '陈旧安全',
      },
      { defaultBoundaries: '新全局边界', defaultGuardrailsPrompt: '新全局安全' },
    )
    expect(prompt).toContain('新全局边界')
    expect(prompt).toContain('新全局安全')
    expect(prompt).not.toContain('陈旧行内')
  })
})
