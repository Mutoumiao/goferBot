/**
 * UT-MD-shape: pipeline metadata 快照结构（task 2.3）
 */
import { describe, expect, it } from 'vitest'
import { CompanionChatPipelineService } from '@/modules/companion/companion-chat-pipeline.service.js'
import type { CompanionState } from '@/modules/companion/langgraph/interfaces.js'

describe('UT-MD: pipeline metadata snapshot', () => {
  it('UT-MD-shape: quality required; no full system prompt field', () => {
    // 直接构造 service 原型方法（避免完整 DI）
    const svc = Object.create(CompanionChatPipelineService.prototype) as CompanionChatPipelineService

    const state = {
      userId: 'u1',
      companionId: 'c1',
      conversationId: 'cv1',
      userMessage: 'hi',
      assistantReply: 'hello',
      quality: {
        status: 'fail',
        score: 0.4,
        sentenceCount: 1,
        questionCount: 0,
        adviceCount: 0,
        violations: [
          {
            code: 'breaks_immersion',
            severity: 'high',
            evidence: '作为一个AI',
          },
        ],
      },
      intent: { primary: 'casual_chat', userNeed: 'chat' },
      route: { route: 'light_companion', responseLength: 'short' },
      extractedMemories: [{ type: 'preference', content: 'cats', importance: 3 }],
    } as unknown as CompanionState

    const raw = svc.buildPipelineMetadataSnapshot(state)
    const meta = JSON.parse(raw) as Record<string, unknown>

    expect(meta.quality).toBeDefined()
    expect((meta.quality as { status: string }).status).toBe('fail')
    expect(meta.intent).toEqual({ primary: 'casual_chat', userNeed: 'chat' })
    expect(meta.route).toEqual({ route: 'light_companion', responseLength: 'short' })
    expect(meta.extractedMemoryCount).toBe(1)
    expect(meta).not.toHaveProperty('systemPrompt')
    expect(JSON.stringify(meta)).not.toContain('systemPrompt')
  })

  it('writes latencyMs into snapshot when provided', () => {
    const svc = Object.create(CompanionChatPipelineService.prototype) as CompanionChatPipelineService
    const state = {
      userId: 'u1',
      companionId: 'c1',
      conversationId: 'cv1',
      userMessage: 'hi',
      assistantReply: 'hello',
      quality: { status: 'pass', score: 1, sentenceCount: 1, questionCount: 0, adviceCount: 0, violations: [] },
    } as unknown as CompanionState

    const meta = JSON.parse(svc.buildPipelineMetadataSnapshot(state, { latencyMs: 1234 })) as {
      latencyMs?: number
    }
    expect(meta.latencyMs).toBe(1234)
  })
})

