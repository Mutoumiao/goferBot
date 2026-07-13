/**
 * 黄金测试：EmotionRoute 规则表（gap-matrix UT-RT-*）
 * fixture: fixtures/route-cases.json
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { RouteNode } from '@/modules/companion/langgraph/nodes/route-node.js'
import type { CompanionState, NodeExecutionContext } from '@/modules/companion/langgraph/interfaces.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cases = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/route-cases.json'), 'utf-8'),
) as Array<{
  id: string
  description: string
  input: { intent: string; emotion: string; relationship: string }
  expect: {
    route?: string
    responseLength?: string
    shouldAskQuestion?: boolean
    shouldGiveAdvice?: boolean
    hasRoute?: boolean
  }
}>

const minimalCtx = {
  userId: 'u1',
  companionId: 'c1',
  conversationId: 'cv1',
  companionName: '测试伴侣',
  signal: new AbortController().signal,
} as NodeExecutionContext

function stateFrom(input: {
  intent: string
  emotion: string
  relationship: string
}): CompanionState {
  return {
    userId: 'u1',
    companionId: 'c1',
    conversationId: 'cv1',
    userMessage: 'test',
    intent: {
      primary: input.intent as never,
      secondary: [],
      confidence: 0.9,
      userNeed: 'test',
      requestedAgentAction: 'listen',
      relationshipSignal: 'neutral',
      replyExpectation: 'continue',
      shouldClarify: false,
      clarifyingQuestion: '',
      promptGuidance: '',
    },
    emotion: {
      primaryEmotion: input.emotion as never,
      secondaryEmotions: [],
      intensity: 0.5,
      valence: 'neutral',
      arousal: 'medium',
      stability: 'stable',
      needsComfort: false,
      needsSpace: false,
      replyTone: 'warm',
    },
    relationship: {
      stage: input.relationship as never,
      intimacyPermission: 'medium',
      trustLevel: 'medium',
      boundarySensitivity: 'medium',
      pacing: 'hold',
      relationshipGuidance: '',
    },
  } as unknown as CompanionState
}

describe('UT-RT: route rules golden', () => {
  const node = new RouteNode()

  for (const c of cases) {
    it(`${c.id}: ${c.description}`, async () => {
      const patch = await node.execute(stateFrom(c.input), minimalCtx)
      expect(patch.route).toBeDefined()
      if (c.expect.hasRoute) {
        expect(patch.route?.route).toBeTruthy()
        return
      }
      if (c.expect.route) expect(patch.route?.route).toBe(c.expect.route)
      if (c.expect.responseLength) {
        expect(patch.route?.responseLength).toBe(c.expect.responseLength)
      }
      if (c.expect.shouldAskQuestion !== undefined) {
        expect(patch.route?.shouldAskQuestion).toBe(c.expect.shouldAskQuestion)
      }
      if (c.expect.shouldGiveAdvice !== undefined) {
        expect(patch.route?.shouldGiveAdvice).toBe(c.expect.shouldGiveAdvice)
      }
    })
  }
})
