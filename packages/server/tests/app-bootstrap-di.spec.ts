import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'
import { AppModule } from '@/app.module.js'
import { ChatFinalizeProcessor } from '@/processors/chat/chat-finalize.processor.js'
import { PrismaService } from '@/processors/database/prisma.service.js'

/**
 * AC-APP-BOOTSTRAP: 应用启动 DI 集成冒烟测试
 *
 * 覆盖目标：
 *   使用 Nest Test.createTestingModule() 动态编译 AppModule，配合 PrismaService 替身，
 *   走完整的 DI 容器构建路径。一旦任何模块之间的依赖链路断裂（例如本次
 *   ChatFinalizeProcessor 新增的 SystemConfigService 未在 QueueModule 链路声明），
 *   AppModule 的编译会直接抛出 "Nest can't resolve dependencies" 错误，让缺陷在
 *   单元测试阶段就暴露，而不是等到 `nest start` 运行时才爆炸。
 *
 * 与 queue-di-smoke.spec.ts 的分工：
 *   - queue-di-smoke.spec.ts 只验证 QueueModule.forRoot() 的 imports 元数据；
 *   - 本测试（AC-APP-BOOTSTRAP）直接编译整个 AppModule，覆盖跨模块的真实 DI 组合。
 *
 * 注意：为避免真实 Prisma 连接，使用 PrismaService 替身（空对象）作为最小可用依赖。
 *       其他 Provider（QueueModule、ChatModule、SettingsModule、KnowledgeAiModule 等）均使用
 *       真实实现，这正是本测试"真实验证"的价值所在。
 */
describe('App Bootstrap DI Integration', () => {
  it('AC-APP-BOOTSTRAP: AppModule compiles without DI errors and ChatFinalizeProcessor is resolvable', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({} as any)
      .compile()

    const processor = moduleRef.get(ChatFinalizeProcessor)
    expect(processor).toBeDefined()
    expect(processor).toBeInstanceOf(ChatFinalizeProcessor)

    await moduleRef.close()
  })
})
