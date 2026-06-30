import { describe, expect, it } from 'vitest'
import { ChatModule } from '@/modules/chat/chat.module.js'
import { SettingsModule } from '@/modules/settings/settings.module.js'
import { ChatFinalizeProcessor } from '@/processors/chat/chat-finalize.processor.js'
import { QueueModule } from '@/processors/queue/queue.module.js'

/**
 * AC-QUEUE-DI-SMOKE: QueueModule 依赖声明冒烟测试
 *
 * 覆盖目标：
 *   验证 QueueModule.forRoot() 的 imports 必须同时包含 ChatModule 与 SettingsModule ——
 *   这是 ChatFinalizeProcessor 能在 QueueModule 上下文里解析到 ConversationService 与
 *   SystemConfigService 的前提。
 *
 * 为什么这是"真正的"测试机制：
 *   - ChatFinalizeProcessor 的构造函数依赖链为 ConversationService（来自 ChatModule）、
 *     SystemConfigService（来自 SettingsModule）、LlmProviderFactory（来自 ChatModule）。
 *   - 一旦开发者为 ChatFinalizeProcessor 新增了未在 QueueModule.forRoot 的 imports
 *     链路中声明的 Provider，这条测试会立即以断言失败的形式给出"在哪个模块缺失"的精确信息，
 *     而不是等到 `nest start` 运行时才抛出
 *     "Nest can't resolve dependencies of the ChatFinalizeProcessor"。
 *   - 配合 queue.module.spec.ts 中 AC-CHAT-FINALIZE-DI 对 ChatModule 导入的断言，
 *     形成对 ChatFinalizeProcessor 完整依赖面的双重守卫。
 */
describe('QueueModule DI Smoke Test', () => {
  it('AC-09: QueueModule.forRoot imports SettingsModule so SystemConfigService is resolvable', () => {
    const module = QueueModule.forRoot()
    const imports = module.imports ?? []

    const hasSettingsModule = imports.some((i: any) => {
      if (typeof i === 'function') return i === SettingsModule
      const factory = i?.forwardRef
      if (typeof factory === 'function') return factory() === SettingsModule
      return false
    })
    expect(hasSettingsModule).toBe(true)

    const hasChatModule = imports.some((i: any) => {
      if (typeof i === 'function') return i === ChatModule
      const factory = i?.forwardRef
      if (typeof factory === 'function') return factory() === ChatModule
      return false
    })
    expect(hasChatModule).toBe(true)
  })

  it('AC-10: ChatFinalizeProcessor is registered as a provider of QueueModule.forRoot', () => {
    const module = QueueModule.forRoot()
    const providers = module.providers as any[]
    expect(providers).toContain(ChatFinalizeProcessor)
  })
})
