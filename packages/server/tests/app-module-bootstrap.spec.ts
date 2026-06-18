import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'
import { DatabaseModule } from '@/processors/database/database.module.js'
import { PrismaService } from '@/processors/database/prisma.service.js'

/**
 * AC-20: DI 编译冒烟测试
 * 目的：验证 NestJS DI 容器能成功编译并解析核心 Provider。
 * 关键：不覆盖 PrismaService，让 DI 容器真正尝试解析其构造函数依赖。
 * 不调用 app.init()，避免触发数据库连接等副作用。
 * 这是防止 DI 配置错误（如不可解析的构造函数参数）的最后一道防线。
 */
describe('DI Bootstrap Smoke Test', () => {
  it('should compile DatabaseModule and resolve PrismaService without DI errors', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile()

    // 关键验证：PrismaService 必须通过 DI 成功实例化
    // 如果构造函数有不可解析的参数（如缺少 @Inject 装饰器的依赖），
    // .compile() 阶段就会抛出错误：
    // "Nest can't resolve dependencies of the PrismaService"
    const prisma = moduleRef.get(PrismaService)
    expect(prisma).toBeDefined()
    expect(prisma).toBeInstanceOf(PrismaService)
  })
})
