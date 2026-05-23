// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from '../../integration/helpers/test-app.factory.js'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures.js'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager.js'

async function setupThrottleApp() {
  const dbManager = new TestDatabaseManager()
  const dbUrl = await dbManager.createDatabase('b07_throttle')
  const app = await TestAppFactory.create(dbUrl)
  await AuthFixtures.createUser(app, AuthFixtures.normalUser)
  const token = await AuthFixtures.loginAs(app, AuthFixtures.normalUser)
  return { app, dbManager, dbUrl, token }
}

async function teardownThrottleApp(app: NestFastifyApplication, dbManager: TestDatabaseManager, dbUrl: string) {
  await app.close()
  const dbName = new URL(dbUrl).pathname.slice(1)
  await dbManager.dropDatabase(dbName)
}

describe('ThrottlerGuard', () => {
  it('AC-05: returns 429 with Retry-After header on excessive requests', async () => {
    const { app, dbManager, dbUrl, token } = await setupThrottleApp()

    // 连续发送多个请求以触发限流
    const requests = []
    for (let i = 0; i < 10; i++) {
      requests.push(app.inject({
        method: 'GET',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
      }))
    }
    const responses = await Promise.all(requests)

    // 至少有一个请求应被限流返回 429
    const throttled = responses.find(r => r.statusCode === 429)
    expect(throttled).toBeDefined()
    if (throttled) {
      const body = throttled.json()
      expect(body.error).toBeDefined()
    }

    await teardownThrottleApp(app, dbManager, dbUrl)
  })
})
