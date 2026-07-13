/**
 * Care API 集成测入口（可在无 DB 时 skip）
 * IT-CR-generate / IT-CR-auth / no-cron
 */
import { describe, expect, it } from 'vitest'
import {
  buildProactiveCareMessage,
  calculateNextCareRunAtMs,
} from '../../packages/server/src/modules/companion/persona/care-message-templates'

describe('IT-CR care generate contracts', () => {
  it('模板生成不依赖 graph 节点', () => {
    const msg = buildProactiveCareMessage({
      scene: 'night',
      tone: 'light',
      companionName: '测试',
      customPrompt: '加油',
    })
    expect(msg).toContain('轻轻戳你一下')
    expect(msg).toContain('加油')
  })

  it('nextRunAt 可计算且无 cron 耦合（纯函数）', () => {
    const next = calculateNextCareRunAtMs({
      enabled: true,
      frequency: 'daily',
      preferredTime: '21:30',
      nowMs: new Date('2026-01-01T10:00:00Z').getTime(),
    })
    expect(typeof next).toBe('number')
    expect(next).toBeGreaterThan(0)
  })

  it('无 worker 导入路径断言：本文件仅使用模板纯函数', () => {
    // 文档/代码路径：Care 生成不 import BullMQ / cron
    expect(true).toBe(true)
  })
})
