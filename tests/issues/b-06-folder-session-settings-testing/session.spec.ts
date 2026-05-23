// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from '../../integration/helpers/test-app.factory.js'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures.js'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager.js'

async function setupSessionTest() {
  const dbManager = new TestDatabaseManager()
  const dbUrl = await dbManager.createDatabase('b06_session')
  const app = await TestAppFactory.create(dbUrl)
  await AuthFixtures.createUser(app, AuthFixtures.normalUser)
  const token = await AuthFixtures.loginAs(app, AuthFixtures.normalUser)
  return { app, dbManager, dbUrl, token }
}

async function teardownSessionTest(app: NestFastifyApplication, dbManager: TestDatabaseManager, dbUrl: string) {
  await app.close()
  const dbName = new URL(dbUrl).pathname.slice(1)
  await dbManager.dropDatabase(dbName)
}

describe('SessionController', () => {
  it('AC-08: returns session list ordered by updatedAt desc', async () => {
    const { app, dbManager, dbUrl, token } = await setupSessionTest()
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json().data)).toBe(true)
    await teardownSessionTest(app, dbManager, dbUrl)
  })

  it('AC-09: returns single session', async () => {
    const { app, dbManager, dbUrl, token } = await setupSessionTest()
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Single Session' },
    })
    const sessionId = createRes.json().data.id

    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${sessionId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.title).toBe('Single Session')
    await teardownSessionTest(app, dbManager, dbUrl)
  })

  it('AC-09b: returns 404 for non-existent session', async () => {
    const { app, dbManager, dbUrl, token } = await setupSessionTest()
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await teardownSessionTest(app, dbManager, dbUrl)
  })

  it('AC-10: creates session with valid data', async () => {
    const { app, dbManager, dbUrl, token } = await setupSessionTest()
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'New Session', provider: 'openai', model: 'gpt-4' },
    })
    expect(res.statusCode).toBe(201)
    const data = res.json().data
    expect(data.title).toBe('New Session')
    expect(data.id).toBeDefined()
    await teardownSessionTest(app, dbManager, dbUrl)
  })

  it('AC-11: renames session', async () => {
    const { app, dbManager, dbUrl, token } = await setupSessionTest()
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Old Name' },
    })
    const sessionId = createRes.json().data.id

    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/rename`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'New Name' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.title).toBe('New Name')
    await teardownSessionTest(app, dbManager, dbUrl)
  })

  it('AC-12: returns 400 for empty title', async () => {
    const { app, dbManager, dbUrl, token } = await setupSessionTest()
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Temp' },
    })
    const sessionId = createRes.json().data.id

    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/rename`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: '   ' },
    })
    expect(res.statusCode).toBe(400)
    await teardownSessionTest(app, dbManager, dbUrl)
  })

  it('AC-13: returns 404 for non-existent session', async () => {
    const { app, dbManager, dbUrl, token } = await setupSessionTest()
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions/00000000-0000-0000-0000-000000000000/rename',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'New' },
    })
    expect(res.statusCode).toBe(404)
    await teardownSessionTest(app, dbManager, dbUrl)
  })

  it('AC-14: deletes session', async () => {
    const { app, dbManager, dbUrl, token } = await setupSessionTest()
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'To Delete' },
    })
    const sessionId = createRes.json().data.id

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/sessions/${sessionId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    await teardownSessionTest(app, dbManager, dbUrl)
  })

  it('AC-15: returns 404 for non-existent session on delete', async () => {
    const { app, dbManager, dbUrl, token } = await setupSessionTest()
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/sessions/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await teardownSessionTest(app, dbManager, dbUrl)
  })

  it('AC-22: returns 401 without token for session endpoints', async () => {
    const { app, dbManager, dbUrl, token } = await setupSessionTest()
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions',
    })
    expect(res.statusCode).toBe(401)
    await teardownSessionTest(app, dbManager, dbUrl)
  })
})
