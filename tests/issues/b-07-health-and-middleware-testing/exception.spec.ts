// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from '../../integration/helpers/test-app.factory.js'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures.js'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager.js'

async function setupExceptionApp() {
  const dbManager = new TestDatabaseManager()
  const dbUrl = await dbManager.createDatabase('b07_exception')
  const app = await TestAppFactory.create(dbUrl)
  await AuthFixtures.createUser(app, AuthFixtures.normalUser)
  const token = await AuthFixtures.loginAs(app, AuthFixtures.normalUser)
  return { app, dbManager, dbUrl, token }
}

async function teardownExceptionApp(app: NestFastifyApplication, dbManager: TestDatabaseManager, dbUrl: string) {
  await app.close()
  const dbName = new URL(dbUrl).pathname.slice(1)
  await dbManager.dropDatabase(dbName)
}

describe('AllExceptionsFilter', () => {
  it('AC-03: returns structured error for unknown route (404)', async () => {
    const { app, dbManager, dbUrl, token } = await setupExceptionApp()
    const res = await app.inject({ method: 'GET', url: '/api/nonexistent-route-12345' })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.error).toBeDefined()
    expect(body.error.code).toBe('NOT_FOUND')
    await teardownExceptionApp(app, dbManager, dbUrl)
  })

  it('AC-03b: returns structured error for validation failure (400)', async () => {
    const { app, dbManager, dbUrl, token } = await setupExceptionApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'a'.repeat(101) },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error).toBeDefined()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    await teardownExceptionApp(app, dbManager, dbUrl)
  })
})
