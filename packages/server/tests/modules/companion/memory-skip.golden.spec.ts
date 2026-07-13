/**
 * 黄金测试：记忆快速跳过 + 关键词（gap-matrix UT-MEM-skip-* / task 2.5）
 */
import { MEMORY_KEYWORD_REGEX } from '@goferbot/data/schemas'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { SharedNodeFactory } from '@/modules/companion/langgraph/nodes/_shared.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cases = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/memory-skip-cases.json'), 'utf-8'),
) as Array<{
  id: string
  description: string
  input: {
    userMessage: string
    existingMemories?: Array<{ content: string }>
  }
  expect: {
    keywordHit?: boolean
    fastSkip?: boolean
    skipCategory?: string
  }
}>

describe('UT-MEM-skip: memory fast-skip + keyword golden', () => {
  // 仅测纯规则方法，不调用 LLM
  const shared = Object.create(SharedNodeFactory.prototype) as SharedNodeFactory

  for (const c of cases) {
    it(`${c.id}: ${c.description}`, () => {
      if (c.expect.keywordHit !== undefined) {
        const hit =
          MEMORY_KEYWORD_REGEX.test(c.input.userMessage) ||
          shared.shouldSkipByKeyword(c.input.userMessage)
        expect(hit).toBe(c.expect.keywordHit)
      }

      if (c.expect.fastSkip !== undefined) {
        const skip = shared.shouldSkipMemoryCandidateFast({
          userText: c.input.userMessage,
          assistantText: '我在听。',
          existingMemories: c.input.existingMemories,
        })
        if (c.expect.fastSkip) {
          expect(skip).not.toBeNull()
          expect(skip?.shouldExtract).toBe(false)
          if (c.expect.skipCategory) {
            expect(skip?.category).toBe(c.expect.skipCategory)
          }
        } else {
          expect(skip).toBeNull()
        }
      }
    })
  }
})
