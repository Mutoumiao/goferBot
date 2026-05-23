// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from '../../integration/helpers/test-app.factory.js'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures.js'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager.js'

async function setupFolderTest() {
  const dbManager = new TestDatabaseManager()
  const dbUrl = await dbManager.createDatabase('b06_folder')
  const app = await TestAppFactory.create(dbUrl)
  await AuthFixtures.createUser(app, AuthFixtures.normalUser)
  const token = await AuthFixtures.loginAs(app, AuthFixtures.normalUser)
  const kbRes = await app.inject({
    method: 'POST',
    url: '/api/knowledge-bases',
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'Test KB' },
  })
  const kbId = kbRes.json().data.id
  return { app, dbManager, dbUrl, token, kbId }
}

async function teardownFolderTest(app: NestFastifyApplication, dbManager: TestDatabaseManager, dbUrl: string) {
  await app.close()
  const dbName = new URL(dbUrl).pathname.slice(1)
  await dbManager.dropDatabase(dbName)
}

describe('FolderController', () => {
  it('AC-01: returns folder list for knowledge base', async () => {
    const { app, dbManager, dbUrl, token, kbId } = await setupFolderTest()
    const res = await app.inject({
      method: 'GET',
      url: `/api/knowledge-bases/${kbId}/folders`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json().data)).toBe(true)
    await teardownFolderTest(app, dbManager, dbUrl)
  })

  it('AC-02: creates folder with valid data', async () => {
    const { app, dbManager, dbUrl, token, kbId } = await setupFolderTest()
    const res = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/folders`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'New Folder' },
    })
    expect(res.statusCode).toBe(201)
    const data = res.json().data
    expect(data.name).toBe('New Folder')
    expect(data.id).toBeDefined()
    await teardownFolderTest(app, dbManager, dbUrl)
  })

  it('AC-03: returns 400 for invalid folder name', async () => {
    const { app, dbManager, dbUrl, token, kbId } = await setupFolderTest()
    const res = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/folders`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: '' },
    })
    expect(res.statusCode).toBe(400)
    await teardownFolderTest(app, dbManager, dbUrl)
  })

  it('AC-04: creates subfolder with parentId', async () => {
    const { app, dbManager, dbUrl, token, kbId } = await setupFolderTest()
    const parentRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/folders`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Parent Folder' },
    })
    const parentId = parentRes.json().data.id

    const childRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/folders`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Child Folder', parentId },
    })
    expect(childRes.statusCode).toBe(201)
    expect(childRes.json().data.parentId).toBe(parentId)

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/knowledge-bases/${kbId}/folders?parentId=${parentId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(listRes.statusCode).toBe(200)
    const list = listRes.json().data
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Child Folder')
    await teardownFolderTest(app, dbManager, dbUrl)
  })

  it('AC-05: updates folder name', async () => {
    const { app, dbManager, dbUrl, token, kbId } = await setupFolderTest()
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/folders`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Old Name' },
    })
    const folderId = createRes.json().data.id

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/knowledge-bases/${kbId}/folders/${folderId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Updated Name' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.name).toBe('Updated Name')
    await teardownFolderTest(app, dbManager, dbUrl)
  })

  it('AC-06: returns 404 for non-existent folder', async () => {
    const { app, dbManager, dbUrl, token, kbId } = await setupFolderTest()
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/knowledge-bases/${kbId}/folders/00000000-0000-0000-0000-000000000000`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Name' },
    })
    expect(res.statusCode).toBe(404)
    await teardownFolderTest(app, dbManager, dbUrl)
  })

  it('AC-07: deletes folder', async () => {
    const { app, dbManager, dbUrl, token, kbId } = await setupFolderTest()
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/folders`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'To Delete' },
    })
    expect(createRes.statusCode).toBe(201)
    const folderId = createRes.json().data.id

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/knowledge-bases/${kbId}/folders/${folderId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    await teardownFolderTest(app, dbManager, dbUrl)
  })

  it('AC-08: returns 404 for non-existent folder on delete', async () => {
    const { app, dbManager, dbUrl, token, kbId } = await setupFolderTest()
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/knowledge-bases/${kbId}/folders/00000000-0000-0000-0000-000000000000`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await teardownFolderTest(app, dbManager, dbUrl)
  })

  it('AC-21: returns 401 without token for folder endpoints', async () => {
    const { app, dbManager, dbUrl, token, kbId } = await setupFolderTest()
    const res = await app.inject({
      method: 'GET',
      url: `/api/knowledge-bases/${kbId}/folders`,
    })
    expect(res.statusCode).toBe(401)
    await teardownFolderTest(app, dbManager, dbUrl)
  })
})
