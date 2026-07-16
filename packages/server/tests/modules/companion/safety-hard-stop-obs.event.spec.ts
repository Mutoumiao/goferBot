import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COMPANION_OBS_SAFETY_HARD_STOP,
  CompanionObsEventRepository,
} from '@/modules/companion/repositories/companion-obs-event.repository.js'

describe('CompanionObsEventRepository safety hard stop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes safety_hard_stop event without throwing', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'e1' })
    const repo = new CompanionObsEventRepository({
      companionObsEvent: { create },
    } as never)

    await repo.recordSafetyHardStop({
      companionId: 'c1',
      conversationId: 'cv1',
      userId: 'u1',
      boundaryAction: 'refuse',
      reason: 'policy',
    })

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: COMPANION_OBS_SAFETY_HARD_STOP,
        companionId: 'c1',
        conversationId: 'cv1',
        userId: 'u1',
        boundaryAction: 'refuse',
        reason: 'policy',
      }),
    })
  })

  it('swallows write errors so chat path is not blocked', async () => {
    const create = vi.fn().mockRejectedValue(new Error('db down'))
    const repo = new CompanionObsEventRepository({
      companionObsEvent: { create },
    } as never)

    await expect(
      repo.recordSafetyHardStop({ companionId: 'c1', boundaryAction: 'crisis_support' }),
    ).resolves.toBeUndefined()
  })
})
