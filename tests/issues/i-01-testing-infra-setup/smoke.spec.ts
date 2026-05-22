import { describe, it, expect } from 'vitest'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager'
import { TestAppFactory } from '../../integration/helpers/test-app.factory'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures'
import { ExternalServiceMocker } from '../../integration/helpers/external-service.mocker'
import { StorageCleaner } from '../../integration/helpers/storage-cleaner'
import { PrismaClient } from '@prisma/client'

describe('Infrastructure Smoke Test', () => {
  const dbManager = new TestDatabaseManager()
  const cleaner = new StorageCleaner()

  it('AC-10: full workflow from DB creation to authenticated request', async () => {
    // 1. 创建测试数据库
    const dbUrl = await dbManager.createDatabase('smoke')
    expect(dbUrl).toContain('goferbot_test_smoke_')

    // 2. 启动 NestJS 应用
    const app = await TestAppFactory.create(dbUrl)
    expect(app).toBeDefined()

    // 3. 注册用户
    const user = await AuthFixtures.createUser(app, {
      email: 'smoke@gofer.bot',
      password: 'Smoke1234!',
      name: 'Smoke',
    })
    expect(user.email).toBe('smoke@gofer.bot')

    // 4. 登录获取 token
    const token = await AuthFixtures.loginAs(app, {
      email: 'smoke@gofer.bot',
      password: 'Smoke1234!',
    })
    expect(token).toBeDefined()
    expect(token.split('.')).toHaveLength(3)

    // 5. 使用 token 访问受保护接口
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(meRes.statusCode).toBe(200)
    const meBody = meRes.json()
    const meData = meBody.data ? meBody.data : meBody
    expect(meData.email).toBe('smoke@gofer.bot')

    // 6. mock LLM 请求
    ExternalServiceMocker.mockLLMStream('mocked response')
    const llmRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [] }),
    })
    const llmText = await llmRes.text()
    expect(llmText).toContain('mocked response')
    ExternalServiceMocker.cleanAll()

    // 7. 清理数据库
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })
    await cleaner.truncateAllTables(prisma)
    const count = await prisma.user.count()
    expect(count).toBe(0)
    await prisma.$disconnect()

    // 8. 关闭应用并删除数据库
    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })
})
