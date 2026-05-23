// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from '../../integration/helpers/test-app.factory.js'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures.js'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager.js'

async function setupValidationApp() {
  const dbManager = new TestDatabaseManager()
  const dbUrl = await dbManager.createDatabase('b07_validation')
  const app = await TestAppFactory.create(dbUrl)
  await AuthFixtures.createUser(app, AuthFixtures.normalUser)
  const token = await AuthFixtures.loginAs(app, AuthFixtures.normalUser)
  return { app, dbManager, dbUrl, token }
}

async function teardownValidationApp(app: NestFastifyApplication, dbManager: TestDatabaseManager, dbUrl: string) {
  await app.close()
  const dbName = new URL(dbUrl).pathname.slice(1)
  await dbManager.dropDatabase(dbName)
}

describe('ZodValidationPipe', () => {
  it('AC-04: returns 400 with field-level errors for invalid input', async () => {
    const { app, dbManager, dbUrl, token } = await setupValidationApp()
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
    expect(body.error.message).toBeDefined()
    await teardownValidationApp(app, dbManager, dbUrl)
  })
})
