import { describe, it, expect } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from '../../integration/helpers/test-app.factory.js'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures.js'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager.js'

describe('KnowledgeBaseController', () => {
  const dbManager = new TestDatabaseManager()

  it('AC-01: lists knowledge bases for current user', async () => {
    const dbUrl = await dbManager.createDatabase('kb_list')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'a1@gofer.bot', password: 'Test1234!', name: 'A1' })
    const token = await AuthFixtures.loginAs(app, { email: 'a1@gofer.bot', password: 'Test1234!' })

    const createRes1 = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'kb1' },
    })
    expect(createRes1.statusCode).toBe(201)

    const createRes2 = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'kb2' },
    })
    expect(createRes2.statusCode).toBe(201)

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(listRes.statusCode).toBe(200)
    const kbs = listRes.json().data
    expect(Array.isArray(kbs)).toBe(true)
    expect(kbs).toHaveLength(2)
    const names = kbs.map((k: { name: string }) => k.name)
    expect(names).toContain('kb1')
    expect(names).toContain('kb2')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-02: creates knowledge base with valid data', async () => {
    const dbUrl = await dbManager.createDatabase('kb_create')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'a2@gofer.bot', password: 'Test1234!', name: 'A2' })
    const token = await AuthFixtures.loginAs(app, { email: 'a2@gofer.bot', password: 'Test1234!' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'new-kb', description: 'test desc', icon: 'star' },
    })
    expect(res.statusCode).toBe(201)
    const kb = res.json().data
    expect(kb.name).toBe('new-kb')
    expect(kb.description).toBe('test desc')
    expect(kb.icon).toBe('star')
    expect(kb.isPinned).toBe(false)
    expect(kb.sortOrder).toBeGreaterThanOrEqual(0)

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-03: updates knowledge base with valid data', async () => {
    const dbUrl = await dbManager.createDatabase('kb_update')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'a3@gofer.bot', password: 'Test1234!', name: 'A3' })
    const token = await AuthFixtures.loginAs(app, { email: 'a3@gofer.bot', password: 'Test1234!' })

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'old-name' },
    })
    const kb = createRes.json().data

    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/knowledge-bases/${kb.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'new-name' },
    })
    expect(updateRes.statusCode).toBe(200)
    const updated = updateRes.json().data
    expect(updated.name).toBe('new-name')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-04: deletes knowledge base and returns confirmation', async () => {
    const dbUrl = await dbManager.createDatabase('kb_delete')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'a4@gofer.bot', password: 'Test1234!', name: 'A4' })
    const token = await AuthFixtures.loginAs(app, { email: 'a4@gofer.bot', password: 'Test1234!' })

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'to-delete' },
    })
    const kb = createRes.json().data

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/knowledge-bases/${kb.id}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(deleteRes.statusCode).toBe(200)
    const result = deleteRes.json().data
    expect(result.id).toBe(kb.id)
    expect(result.deleted).toBe(true)

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-05: returns empty array when no knowledge bases exist', async () => {
    const dbUrl = await dbManager.createDatabase('kb_empty')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'a5@gofer.bot', password: 'Test1234!', name: 'A5' })
    const token = await AuthFixtures.loginAs(app, { email: 'a5@gofer.bot', password: 'Test1234!' })

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(listRes.statusCode).toBe(200)
    const kbs = listRes.json().data
    expect(Array.isArray(kbs)).toBe(true)
    expect(kbs).toHaveLength(0)

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-06: updates with empty body returns unchanged', async () => {
    expect(true).toBe(false)
  })

  it('AC-07: updates isPinned and sortOrder', async () => {
    expect(true).toBe(false)
  })

  it('AC-08: returns 400 when name is empty string', async () => {
    expect(true).toBe(false)
  })

  it('AC-09: returns 400 when name exceeds 100 chars', async () => {
    expect(true).toBe(false)
  })

  it('AC-10: returns 400 when description exceeds 500 chars', async () => {
    expect(true).toBe(false)
  })

  it('AC-11: returns 400 when sortOrder is negative', async () => {
    expect(true).toBe(false)
  })

  it('AC-12: returns 401 without valid JWT', async () => {
    expect(true).toBe(false)
  })

  it('AC-13: returns 403 for non-owner access', async () => {
    expect(true).toBe(false)
  })

  it('AC-14: returns 404 for non-existent knowledge base', async () => {
    expect(true).toBe(false)
  })

  it('AC-15: user A cannot see user B knowledge bases', async () => {
    expect(true).toBe(false)
  })
})
