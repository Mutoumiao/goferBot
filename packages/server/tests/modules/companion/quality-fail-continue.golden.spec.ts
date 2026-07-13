/**
 * UT-QL-fail-continue: Quality fail 后图仍连向 summary（task 2.2 契约）
 *
 * 完整 Graph compile 依赖 Nest DI；此处以源码契约 + quality 节点结果断言观测语义：
 * fail 状态不得清空 assistantReply。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { QualityGuardNode } from '@/modules/companion/langgraph/nodes/quality-guard-node.js'
import type { CompanionState, NodeExecutionContext } from '@/modules/companion/langgraph/interfaces.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('UT-QL-fail-continue', () => {
  it('quality fail keeps assistantReply and graph source routes quality → summary', async () => {
    const graphSrc = readFileSync(
      path.join(__dirname, '../../../src/modules/companion/langgraph/graph.ts'),
      'utf-8',
    )
    // 观测型：quality → summary 直连（不再因 fail 走 end_guard）
    expect(graphSrc).toMatch(/addEdge\(\s*'quality'[\s\S]*?'summary'/)
    expect(graphSrc).not.toMatch(/quality[\s\S]{0,200}end_guard/)
    expect(graphSrc).not.toMatch(/status === 'fail'[\s\S]{0,80}end_guard/)

    const node = new QualityGuardNode()
    const reply = '作为一个AI，我理解你。'
    const state = {
      userId: 'u1',
      companionId: 'c1',
      conversationId: 'cv1',
      userMessage: 'hi',
      assistantReply: reply,
    } as CompanionState
    const ctx = {
      userId: 'u1',
      companionId: 'c1',
      conversationId: 'cv1',
      companionName: 'x',
      signal: new AbortController().signal,
    } as NodeExecutionContext

    const patch = await node.execute(state, ctx)
    expect(patch.quality?.status).toBe('fail')
    // 节点不修改/不删除主回复
    expect(state.assistantReply).toBe(reply)
  })
})
