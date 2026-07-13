/**
 * 黄金测试：QualityGuard 纯规则（gap-matrix UT-QL-*）
 * fixture: fixtures/quality-cases.json
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { QualityGuardNode } from '@/modules/companion/langgraph/nodes/quality-guard-node.js'
import type { CompanionState, NodeExecutionContext } from '@/modules/companion/langgraph/interfaces.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cases = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/quality-cases.json'), 'utf-8'),
) as Array<{
  id: string
  description: string
  input: { assistantReply: string; qualityFailContinue?: boolean }
  expect: { status?: string; violationCodes?: string[]; note?: string }
}>

const minimalCtx = {
  userId: 'u1',
  companionId: 'c1',
  conversationId: 'cv1',
  companionName: '测试伴侣',
  signal: new AbortController().signal,
} as NodeExecutionContext

describe('UT-QL: quality guard golden', () => {
  const node = new QualityGuardNode()

  for (const c of cases) {
    it(`${c.id}: ${c.description}`, async () => {
      const state = {
        userId: 'u1',
        companionId: 'c1',
        conversationId: 'cv1',
        userMessage: 'hi',
        assistantReply: c.input.assistantReply,
      } as CompanionState

      const patch = await node.execute(state, minimalCtx)
      expect(patch.quality).toBeDefined()

      if (c.expect.status) {
        expect(patch.quality?.status).toBe(c.expect.status)
      }
      if (c.expect.violationCodes?.length) {
        const codes = (patch.quality?.violations ?? []).map((v) => v.code)
        for (const code of c.expect.violationCodes) {
          expect(codes).toContain(code)
        }
      }
      // qualityFailContinue 仅契约标注：主回复字段仍存在
      if (c.input.qualityFailContinue) {
        expect(state.assistantReply).toBeTruthy()
        expect(patch.quality?.status).toBe('fail')
      }
    })
  }
})
