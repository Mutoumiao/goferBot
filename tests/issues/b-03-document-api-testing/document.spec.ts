import { describe, it, expect } from 'vitest'
import { Test } from '@nestjs/testing'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { CanActivate } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import { TestAppFactory } from '../../integration/helpers/test-app.factory.js'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures.js'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager.js'
import { PrismaService } from '../../../packages/server/src/processors/database/prisma.service.js'
import { QueueService } from '../../../packages/server/src/processors/queue/queue.service.js'
import { VectorService } from '../../../packages/server/src/processors/vector/vector.service.js'
import { StorageService } from '../../../packages/server/src/processors/storage/storage.service.js'
import { AppModule } from '../../../packages/server/src/app.module.js'
import { bootstrap } from '../../../packages/server/src/bootstrap.js'

const mockStorageService = {
  uploadFile: async () => 'mock-key',
  downloadFile: async () => Buffer.from(''),
  deleteFile: async () => {},
  getUrl: () => 'http://mock.url',
  getPresignedUploadUrl: async () => 'http://mock.url',
}

async function createAppWithMocks(dbUrl: string): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(
      new PrismaService({
        datasources: { db: { url: dbUrl } },
      }),
    )
    .overrideProvider(QueueService)
    .useValue({
      onModuleInit: async () => {},
      onModuleDestroy: async () => {},
      addDocumentJob: async () => null,
      addEmbeddingJob: async () => null,
      getJobStatus: async () => null,
      getQueueStats: async () => ({
        documentQueue: {},
        embeddingQueue: {},
      }),
      getDocumentQueue: () => null,
      getEmbeddingQueue: () => null,
      getRedisConnection: () => null,
    })
    .overrideProvider(VectorService)
    .useValue({
      onModuleInit: async () => {},
      ensureCollection: async () => {},
      insertVectors: async () => {},
      searchVectors: async () => [],
      deleteByIds: async () => {},
      deleteByFileId: async () => {},
      deleteByKbId: async () => {},
    })
    .overrideProvider(StorageService)
    .useValue(mockStorageService)
    .overrideModule(ThrottlerModule)
    .useModule(
      ThrottlerModule.forRoot([
        { name: 'default', ttl: 60000, limit: 9999 },
        { name: 'auth', ttl: 60000, limit: 9999 },
      ]),
    )
    .compile()

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ bodyLimit: 1048576 }),
  )

  await bootstrap(app)
  await app.init()
  await app.getHttpAdapter().getInstance().ready()

  return app
}

async function createKnowledgeBase(
  app: NestFastifyApplication,
  token: string,
  name = 'Test KB',
): Promise<{ id: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/knowledge-bases',
    headers: { authorization: `Bearer ${token}` },
    payload: { name },
  })
  expect(res.statusCode).toBe(201)
  const body = res.json()
  return body.data ? body.data : body
}

function buildMultipartPayload(
  filename: string,
  content: Buffer,
  options?: { folderId?: string; mimeType?: string },
): { payload: Buffer; headers: Record<string, string> } {
  const boundary = '----FormBoundary' + Date.now()
  const mimeType = options?.mimeType ?? 'application/octet-stream'
  let body = Buffer.from('')

  body = Buffer.concat([
    body,
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`),
    Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`),
    content,
    Buffer.from(`\r\n`),
  ])

  if (options?.folderId !== undefined) {
    body = Buffer.concat([
      body,
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="folderId"\r\n\r\n`),
      Buffer.from(`${options.folderId}\r\n`),
    ])
  }

  body = Buffer.concat([body, Buffer.from(`--${boundary}--\r\n`)])

  return {
    payload: body,
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
  }
}

describe('DocumentController', () => {
  const dbManager = new TestDatabaseManager()

  it('AC-01: lists documents for owned knowledge base', async () => {
    const dbUrl = await dbManager.createDatabase('doc_list')
    const app = await createAppWithMocks(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'a1@gofer.bot', password: 'Test1234!', name: 'A1' })
    const token = await AuthFixtures.loginAs(app, { email: 'a1@gofer.bot', password: 'Test1234!' })
    const kb = await createKnowledgeBase(app, token)

    const createRes1 = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kb.id}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'doc1' },
    })
    expect(createRes1.statusCode).toBe(201)

    const createRes2 = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kb.id}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'doc2' },
    })
    expect(createRes2.statusCode).toBe(201)

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/knowledge-bases/${kb.id}/documents`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(listRes.statusCode).toBe(200)
    const body = listRes.json()
    const docs = body.data ? body.data : body
    expect(Array.isArray(docs)).toBe(true)
    expect(docs).toHaveLength(2)
    expect(docs[0].name).toBe('doc2')
    expect(docs[1].name).toBe('doc1')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-02: uploads a valid file and creates document record', async () => {
    const dbUrl = await dbManager.createDatabase('doc_upload')
    const app = await createAppWithMocks(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'a2@gofer.bot', password: 'Test1234!', name: 'A2' })
    const token = await AuthFixtures.loginAs(app, { email: 'a2@gofer.bot', password: 'Test1234!' })
    const kb = await createKnowledgeBase(app, token)

    const { payload, headers } = buildMultipartPayload('test.md', Buffer.from('# hello'))
    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kb.id}/documents/upload`,
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload,
    })
    expect(uploadRes.statusCode).toBe(201)
    const body = uploadRes.json()
    const doc = body.data ? body.data : body
    expect(doc.name).toBe('test.md')
    expect(doc.ext).toBe('md')
    expect(doc.mimeType).toBe('application/octet-stream')
    expect(doc.status).toBe('uploaded')
    expect(doc.storageKey).toContain(kb.id)

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-03: creates a document with valid data', async () => {
    const dbUrl = await dbManager.createDatabase('doc_create')
    const app = await createAppWithMocks(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'a3@gofer.bot', password: 'Test1234!', name: 'A3' })
    const token = await AuthFixtures.loginAs(app, { email: 'a3@gofer.bot', password: 'Test1234!' })
    const kb = await createKnowledgeBase(app, token)

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kb.id}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'new-doc' },
    })
    expect(createRes.statusCode).toBe(201)
    const body = createRes.json()
    const doc = body.data ? body.data : body
    expect(doc.name).toBe('new-doc')
    expect(doc.ext).toBeNull()
    expect(doc.mimeType).toBeNull()
    expect(doc.size).toBeNull()
    expect(doc.status).toBe('uploaded')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-04: updates a document with valid data', async () => {
    const dbUrl = await dbManager.createDatabase('doc_update')
    const app = await createAppWithMocks(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'a4@gofer.bot', password: 'Test1234!', name: 'A4' })
    const token = await AuthFixtures.loginAs(app, { email: 'a4@gofer.bot', password: 'Test1234!' })
    const kb = await createKnowledgeBase(app, token)

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kb.id}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'old-name' },
    })
    const createBody = createRes.json()
    const doc = createBody.data ? createBody.data : createBody

    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/knowledge-bases/${kb.id}/documents/${doc.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'new-name' },
    })
    expect(updateRes.statusCode).toBe(200)
    const updateBody = updateRes.json()
    const updated = updateBody.data ? updateBody.data : updateBody
    expect(updated.name).toBe('new-name')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-05: deletes a document and returns confirmation', async () => {
    const dbUrl = await dbManager.createDatabase('doc_delete')
    const app = await createAppWithMocks(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'a5@gofer.bot', password: 'Test1234!', name: 'A5' })
    const token = await AuthFixtures.loginAs(app, { email: 'a5@gofer.bot', password: 'Test1234!' })
    const kb = await createKnowledgeBase(app, token)

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kb.id}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'to-delete' },
    })
    const createBody = createRes.json()
    const doc = createBody.data ? createBody.data : createBody

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/knowledge-bases/${kb.id}/documents/${doc.id}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(deleteRes.statusCode).toBe(200)
    const deleteBody = deleteRes.json()
    const result = deleteBody.data ? deleteBody.data : deleteBody
    expect(result.id).toBe(doc.id)
    expect(result.deleted).toBe(true)

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-06: returns empty array when no documents exist', async () => {
    const dbUrl = await dbManager.createDatabase('doc_empty')
    const app = await createAppWithMocks(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'a6@gofer.bot', password: 'Test1234!', name: 'A6' })
    const token = await AuthFixtures.loginAs(app, { email: 'a6@gofer.bot', password: 'Test1234!' })
    const kb = await createKnowledgeBase(app, token)

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/knowledge-bases/${kb.id}/documents`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(listRes.statusCode).toBe(200)
    const body = listRes.json()
    const docs = body.data ? body.data : body
    expect(Array.isArray(docs)).toBe(true)
    expect(docs).toHaveLength(0)

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-07: lists documents filtered by folderId', async () => {
    const dbUrl = await dbManager.createDatabase('doc_filter')
    const app = await createAppWithMocks(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'a7@gofer.bot', password: 'Test1234!', name: 'A7' })
    const token = await AuthFixtures.loginAs(app, { email: 'a7@gofer.bot', password: 'Test1234!' })
    const kb = await createKnowledgeBase(app, token)

    const folderRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kb.id}/folders`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'folder1' },
    })
    expect(folderRes.statusCode).toBe(201)
    const folderBody = folderRes.json()
    const folder = folderBody.data ? folderBody.data : folderBody

    const docRes1 = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kb.id}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'in-folder', folderId: folder.id },
    })
    expect(docRes1.statusCode).toBe(201)

    const docRes2 = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kb.id}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'no-folder' },
    })
    expect(docRes2.statusCode).toBe(201)

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/knowledge-bases/${kb.id}/documents?folderId=${folder.id}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(listRes.statusCode).toBe(200)
    const body = listRes.json()
    const docs = body.data ? body.data : body
    expect(docs).toHaveLength(1)
    expect(docs[0].name).toBe('in-folder')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-08: updates document with empty body returns unchanged', async () => {
    const dbUrl = await dbManager.createDatabase('doc_empty_body')
    const app = await createAppWithMocks(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'a8@gofer.bot', password: 'Test1234!', name: 'A8' })
    const token = await AuthFixtures.loginAs(app, { email: 'a8@gofer.bot', password: 'Test1234!' })
    const kb = await createKnowledgeBase(app, token)

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kb.id}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'unchanged' },
    })
    const createBody = createRes.json()
    const doc = createBody.data ? createBody.data : createBody

    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/knowledge-bases/${kb.id}/documents/${doc.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })
    expect(updateRes.statusCode).toBe(200)
    const updateBody = updateRes.json()
    const updated = updateBody.data ? updateBody.data : updateBody
    expect(updated.name).toBe('unchanged')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-09: returns 400 when name is empty string', async () => {
    const dbUrl = await dbManager.createDatabase('doc_name_empty')
    const app = await createAppWithMocks(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'a9@gofer.bot', password: 'Test1234!', name: 'A9' })
    const token = await AuthFixtures.loginAs(app, { email: 'a9@gofer.bot', password: 'Test1234!' })
    const kb = await createKnowledgeBase(app, token)

    const res = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kb.id}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: '' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-10: returns 400 when name exceeds 255 chars', async () => {
    const dbUrl = await dbManager.createDatabase('doc_name_long')
    const app = await createAppWithMocks(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'a10@gofer.bot', password: 'Test1234!', name: 'A10' })
    const token = await AuthFixtures.loginAs(app, { email: 'a10@gofer.bot', password: 'Test1234!' })
    const kb = await createKnowledgeBase(app, token)

    const res = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kb.id}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'a'.repeat(256) },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-11: returns 400 when folderId is not uuid', async () => {
    const dbUrl = await dbManager.createDatabase('doc_folderid_bad')
    const app = await createAppWithMocks(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'a11@gofer.bot', password: 'Test1234!', name: 'A11' })
    const token = await AuthFixtures.loginAs(app, { email: 'a11@gofer.bot', password: 'Test1234!' })
    const kb = await createKnowledgeBase(app, token)

    const res = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kb.id}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'valid', folderId: 'not-a-uuid' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-12: returns 400 when query folderId is not uuid', async () => {
    const dbUrl = await dbManager.createDatabase('doc_query_folderid')
    const app = await createAppWithMocks(dbUrl)

    const user = await AuthFixtures.createUser(app, { email: 'a12@gofer.bot', password: 'Test1234!', name: 'A12' })
    const token = await AuthFixtures.loginAs(app, { email: 'a12@gofer.bot', password: 'Test1234!' })
    const kb = await createKnowledgeBase(app, token)

    const res = await app.inject({
      method: 'GET',
      url: `/api/knowledge-bases/${kb.id}/documents?folderId=bad-id`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-13: returns 413 for file exceeding 50MB', async () => {
    expect(true).toBe(false)
  })

  it('AC-14: returns 415 for unsupported file type', async () => {
    expect(true).toBe(false)
  })

  it('AC-15: returns 415 for filename with illegal characters', async () => {
    expect(true).toBe(false)
  })

  it('AC-16: accepts empty file (0 bytes) as valid', async () => {
    expect(true).toBe(false)
  })

  it('AC-17: returns 401 without valid JWT', async () => {
    expect(true).toBe(false)
  })

  it('AC-18: returns 403 for non-owner access', async () => {
    expect(true).toBe(false)
  })

  it('AC-19: returns 404 for non-existent knowledge base', async () => {
    expect(true).toBe(false)
  })

  it('AC-20: returns 404 for non-existent document', async () => {
    expect(true).toBe(false)
  })

  it('AC-21: returns 404 for invalid docId format', async () => {
    expect(true).toBe(false)
  })
})
