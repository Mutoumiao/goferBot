import { describe, expect, it } from 'vitest'
import {
  COMPANION_AVATAR_MIN_SHORT_SIDE,
  COMPANION_AVATAR_TARGET_RATIO,
  validateCompanionAvatarClient,
} from '../src/features/companion/persona/avatar-validation'
import { buildDefaultAgentPrompt } from '../src/features/companion/persona/build-default-agent-prompt'
import {
  buildOpeningUiMessage,
  shouldShowOpeningMessage,
} from '../src/features/companion/persona/opening-message'

describe('UT-PS-prompt-build (web preview)', () => {
  it('章节顺序与空节省略', () => {
    const p = buildDefaultAgentPrompt({
      name: 'Luna',
      headline: '温柔',
      personality: '慢热',
    })
    expect(p.indexOf('## 一句话设定')).toBeLessThan(p.indexOf('## 性格与互动方式'))
    expect(p).not.toContain('## 人物故事背景')
  })
})

describe('UT-OP-empty-only opening message', () => {
  it('仅空列表且非空 opening 时展示', () => {
    expect(shouldShowOpeningMessage({ messageCount: 0, openingMessage: '你好' })).toBe(true)
    expect(shouldShowOpeningMessage({ messageCount: 1, openingMessage: '你好' })).toBe(false)
    expect(shouldShowOpeningMessage({ messageCount: 0, openingMessage: '  ' })).toBe(false)
    expect(shouldShowOpeningMessage({ messageCount: 0, openingMessage: undefined })).toBe(false)
  })

  it('opening id 稳定', () => {
    expect(
      buildOpeningUiMessage({
        conversationId: 'c1',
        companionId: 'a1',
        openingMessage: '嗨',
      }).id,
    ).toBe('opening-c1')
    expect(
      buildOpeningUiMessage({
        conversationId: null,
        companionId: 'a1',
        openingMessage: '嗨',
      }).id,
    ).toBe('opening-pending-a1')
  })
})

describe('UT-AV-validate client', () => {
  it('合法 2:3 通过', () => {
    const w = COMPANION_AVATAR_MIN_SHORT_SIDE
    const h = Math.round(w / COMPANION_AVATAR_TARGET_RATIO)
    expect(
      validateCompanionAvatarClient({
        mimeType: 'image/png',
        sizeBytes: 1024,
        width: w,
        height: h,
      }).ok,
    ).toBe(true)
  })
})
