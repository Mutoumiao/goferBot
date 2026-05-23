---
id: b-03
issue: issue.md
version: 1
---

# DocumentController 测试实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 为 DocumentController 全部 5 个端点编写模块级集成测试，覆盖正常流程、DTO 校验、文件上传边界、权限控制和错误响应。

**架构：** 使用 `TestAppFactory` 启动完整 NestJS 应用（含 Fastify + bootstrap），每个 `describe` 块独立创建/销毁数据库。`StorageService` 通过 `overrideProvider` mock，避免真实 MinIO 依赖。测试通过 `app.inject()` 发送 HTTP 请求，验证响应状态码和结构。

**技术栈：** Vitest + NestJS TestingModule + Fastify Adapter + Prisma + nock

**Issue 引用：** [issue.md](issue.md)
**Spec 引用：** [specs/feature-spec.md](specs/feature-spec.md) | [specs/api-spec.md](specs/api-spec.md)

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `tests/issues/b-03-document-api-testing/document.spec.ts` | 主测试文件，21 条 AC 用例 |

---

## 前置依赖

- `TEST_DATABASE_ADMIN_URL` 环境变量已设置
- `b-02-auth-api-testing` 已完成（`AuthFixtures`、`TestAppFactory` 可用）
- `i-01` 已完成（测试基础设施就绪）

---

## 辅助函数（在测试文件顶部定义）

```typescript
// 在 document.spec.ts 中定义，供所有用例使用

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

  // file field
  body = Buffer.concat([
    body,
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`),
    Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`),
    content,
    Buffer.from(`\r\n`),
  ])

  // optional folderId field
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
```

---

## 任务 1: 搭建测试骨架与辅助函数

**文件：**
- 创建：`tests/issues/b-03-document-api-testing/document.spec.ts`

**规格引用：**
- API 规格：[测试映射 - 全部 AC]

- [ ] **步骤 1: 编写失败测试（骨架）**

创建测试文件，导入依赖，定义 `createKnowledgeBase` 和 `buildMultipartPayload` 辅助函数，编写所有 21 个 `it` 块（仅包含 `expect(true).toBe(false)` 占位），确保测试文件能被 Vitest 识别。

```typescript
import { describe, it, expect } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from '../../integration/helpers/test-app.factory'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager'

describe('DocumentController', () => {
  const dbManager = new TestDatabaseManager()

  it('AC-01: lists documents for owned knowledge base', async () => {
    expect(true).toBe(false)
  })

  // ... 其余 20 个 AC 占位
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-03-document-api-testing/document.spec.ts`
预期：FAIL — 21 个测试全部失败（`expected true to be false`）

- [ ] **步骤 3: 提交**

```bash
git add tests/issues/b-03-document-api-testing/document.spec.ts
git commit -m "test(b-03): add DocumentController test skeleton with 21 AC placeholders"
```

---

## 任务 2: AC-01 ~ AC-06 — 正常流程测试

**文件：**
- 修改：`tests/issues/b-03-document-api-testing/document.spec.ts`

**规格引用：**
- API 规格：[GET /api/knowledge-bases/:kbId/documents 200]、[POST upload 201]、[POST create 201]、[PATCH 200]、[DELETE 200]

- [ ] **步骤 1: 编写失败测试（AC-01 ~ AC-06）**

替换占位为真实测试代码。每个测试：
1. 创建独立数据库
2. 启动应用
3. 注册用户 A，登录获取 token
4. 创建知识库
5. 执行被测操作
6. 断言响应
7. 关闭应用，销毁数据库

```typescript
it('AC-01: lists documents for owned knowledge base', async () => {
  const dbUrl = await dbManager.createDatabase('doc_list')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a1@gofer.bot', password: 'Test1234!', name: 'A1' })
  const token = await AuthFixtures.loginAs(app, { email: 'a1@gofer.bot', password: 'Test1234!' })
  const kb = await createKnowledgeBase(app, token)

  // 先创建两个文档
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

  // 列表
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
  expect(docs[0].name).toBe('doc2') // desc 排序
  expect(docs[1].name).toBe('doc1')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

it('AC-02: uploads a valid file and creates document record', async () => {
  const dbUrl = await dbManager.createDatabase('doc_upload')
  const app = await TestAppFactory.create(dbUrl)

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
  expect(doc.mimeType).toBe('application/octet-stream') // 测试 payload 的默认 mime
  expect(doc.status).toBe('uploaded')
  expect(doc.storageKey).toContain(kb.id)

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

it('AC-03: creates a document with valid data', async () => {
  const dbUrl = await dbManager.createDatabase('doc_create')
  const app = await TestAppFactory.create(dbUrl)

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
  const app = await TestAppFactory.create(dbUrl)

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
  const app = await TestAppFactory.create(dbUrl)

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
  const app = await TestAppFactory.create(dbUrl)

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
```

- [ ] **步骤 2: 运行测试验证失败（RED）**

运行：`npx vitest run tests/issues/b-03-document-api-testing/document.spec.ts --reporter=verbose`
预期：FAIL — AC-01~AC-06 因测试断言与生产代码实际行为不匹配而失败（如响应字段缺失、状态码不符等）。必须观察到失败后再继续。

- [ ] **步骤 3: 运行测试验证通过（GREEN）**

运行：`npx vitest run tests/issues/b-03-document-api-testing/document.spec.ts --reporter=verbose`
预期：PASS — AC-01~AC-06 全部通过

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-03-document-api-testing/document.spec.ts
git commit -m "test(b-03): AC-01~AC-06 normal flow tests for DocumentController"
```

---

## 任务 3: AC-07 ~ AC-08 — 文件夹筛选与空 body 更新

**文件：**
- 修改：`tests/issues/b-03-document-api-testing/document.spec.ts`

**规格引用：**
- API 规格：[GET folderId 筛选]、[PATCH 空 body]

- [ ] **步骤 1: 编写失败测试（AC-07 ~ AC-08）**

```typescript
it('AC-07: lists documents filtered by folderId', async () => {
  const dbUrl = await dbManager.createDatabase('doc_filter')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a7@gofer.bot', password: 'Test1234!', name: 'A7' })
  const token = await AuthFixtures.loginAs(app, { email: 'a7@gofer.bot', password: 'Test1234!' })
  const kb = await createKnowledgeBase(app, token)

  // 通过 Folder API 创建 folder（测试必须走 API，不直接操作 Prisma）
  const folderRes = await app.inject({
    method: 'POST',
    url: `/api/knowledge-bases/${kb.id}/folders`,
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'folder1' },
  })
  expect(folderRes.statusCode).toBe(201)
  const folderBody = folderRes.json()
  const folder = folderBody.data ? folderBody.data : folderBody

  // 创建带 folder 的文档
  const docRes1 = await app.inject({
    method: 'POST',
    url: `/api/knowledge-bases/${kb.id}/documents`,
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'in-folder', folderId: folder.id },
  })
  expect(docRes1.statusCode).toBe(201)

  // 创建不带 folder 的文档
  const docRes2 = await app.inject({
    method: 'POST',
    url: `/api/knowledge-bases/${kb.id}/documents`,
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'no-folder' },
  })
  expect(docRes2.statusCode).toBe(201)

  // 按 folderId 筛选
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
  const app = await TestAppFactory.create(dbUrl)

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
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-03-document-api-testing/document.spec.ts --reporter=verbose`
预期：FAIL — AC-07 可能因 Folder API 不存在而失败；AC-08 可能因空 body 处理而失败

- [ ] **步骤 3: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-03-document-api-testing/document.spec.ts --reporter=verbose`
预期：PASS — AC-07~AC-08 通过

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-03-document-api-testing/document.spec.ts
git commit -m "test(b-03): AC-07~AC-08 folder filter and empty body update tests"
```

---

## 任务 4: AC-09 ~ AC-12 — DTO 校验错误测试

**文件：**
- 修改：`tests/issues/b-03-document-api-testing/document.spec.ts`

**规格引用：**
- API 规格：[POST create 400]、[PATCH 400]、[GET 400 folderId]

- [ ] **步骤 1: 编写失败测试（AC-09 ~ AC-12）**

```typescript
it('AC-09: returns 400 when name is empty string', async () => {
  const dbUrl = await dbManager.createDatabase('doc_name_empty')
  const app = await TestAppFactory.create(dbUrl)

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
  const app = await TestAppFactory.create(dbUrl)

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
  const app = await TestAppFactory.create(dbUrl)

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
  const app = await TestAppFactory.create(dbUrl)

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
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-03-document-api-testing/document.spec.ts --reporter=verbose`
预期：FAIL — 400 错误码验证失败

- [ ] **步骤 3: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-03-document-api-testing/document.spec.ts --reporter=verbose`
预期：PASS — AC-09~AC-12 通过

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-03-document-api-testing/document.spec.ts
git commit -m "test(b-03): AC-09~AC-12 DTO validation error tests"
```

---

## 任务 5: AC-13 ~ AC-16 — 文件上传边界测试

**文件：**
- 修改：`tests/issues/b-03-document-api-testing/document.spec.ts`

**规格引用：**
- API 规格：[POST upload 413]、[POST upload 415 文件类型]、[POST upload 415 文件名]、[空文件]

- [ ] **步骤 1: 编写失败测试（AC-13 ~ AC-16）**

```typescript
it('AC-13: returns 413 for file exceeding 50MB', async () => {
  const dbUrl = await dbManager.createDatabase('doc_413')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a13@gofer.bot', password: 'Test1234!', name: 'A13' })
  const token = await AuthFixtures.loginAs(app, { email: 'a13@gofer.bot', password: 'Test1234!' })
  const kb = await createKnowledgeBase(app, token)

  // 构造略大于 50MB 的文件。使用 1MB 的 chunk 重复 51 次，避免单次大内存分配。
  const chunk = Buffer.alloc(1024 * 1024)
  const bigBuffer = Buffer.concat(Array(51).fill(chunk))
  const { payload, headers } = buildMultipartPayload('big.md', bigBuffer)
  const res = await app.inject({
    method: 'POST',
    url: `/api/knowledge-bases/${kb.id}/documents/upload`,
    headers: { ...headers, authorization: `Bearer ${token}` },
    payload,
  })
  expect(res.statusCode).toBe(413)
  const body = res.json()
  expect(body.error.code).toBe('PAYLOAD_TOO_LARGE')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

it('AC-14: returns 415 for unsupported file type', async () => {
  const dbUrl = await dbManager.createDatabase('doc_415_type')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a14@gofer.bot', password: 'Test1234!', name: 'A14' })
  const token = await AuthFixtures.loginAs(app, { email: 'a14@gofer.bot', password: 'Test1234!' })
  const kb = await createKnowledgeBase(app, token)

  const { payload, headers } = buildMultipartPayload('virus.exe', Buffer.from('fake'))
  const res = await app.inject({
    method: 'POST',
    url: `/api/knowledge-bases/${kb.id}/documents/upload`,
    headers: { ...headers, authorization: `Bearer ${token}` },
    payload,
  })
  expect(res.statusCode).toBe(415)
  const body = res.json()
  expect(body.error.code).toBe('UNSUPPORTED_TYPE')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

it('AC-15: returns 415 for filename with illegal characters', async () => {
  const dbUrl = await dbManager.createDatabase('doc_415_name')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a15@gofer.bot', password: 'Test1234!', name: 'A15' })
  const token = await AuthFixtures.loginAs(app, { email: 'a15@gofer.bot', password: 'Test1234!' })
  const kb = await createKnowledgeBase(app, token)

  const { payload, headers } = buildMultipartPayload('../etc/passwd.md', Buffer.from('# hello'))
  const res = await app.inject({
    method: 'POST',
    url: `/api/knowledge-bases/${kb.id}/documents/upload`,
    headers: { ...headers, authorization: `Bearer ${token}` },
    payload,
  })
  expect(res.statusCode).toBe(415)
  const body = res.json()
  expect(body.error.code).toBe('UNSUPPORTED_TYPE')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

it('AC-16: accepts empty file (0 bytes) as valid', async () => {
  const dbUrl = await dbManager.createDatabase('doc_empty_file')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a16@gofer.bot', password: 'Test1234!', name: 'A16' })
  const token = await AuthFixtures.loginAs(app, { email: 'a16@gofer.bot', password: 'Test1234!' })
  const kb = await createKnowledgeBase(app, token)

  const { payload, headers } = buildMultipartPayload('empty.md', Buffer.alloc(0))
  const res = await app.inject({
    method: 'POST',
    url: `/api/knowledge-bases/${kb.id}/documents/upload`,
    headers: { ...headers, authorization: `Bearer ${token}` },
    payload,
  })
  expect(res.statusCode).toBe(201)
  const body = res.json()
  const doc = body.data ? body.data : body
  expect(doc.name).toBe('empty.md')
  expect(doc.size).toBe(0)

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-03-document-api-testing/document.spec.ts --reporter=verbose`
预期：FAIL — 413/415 错误码验证失败

- [ ] **步骤 3: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-03-document-api-testing/document.spec.ts --reporter=verbose`
预期：PASS — AC-13~AC-16 通过

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-03-document-api-testing/document.spec.ts
git commit -m "test(b-03): AC-13~AC-16 file upload boundary tests"
```

---

## 任务 6: AC-17 ~ AC-18 — 认证与权限测试

**文件：**
- 修改：`tests/issues/b-03-document-api-testing/document.spec.ts`

**规格引用：**
- API 规格：[401 场景]、[403 场景]

- [ ] **步骤 1: 编写失败测试（AC-17 ~ AC-18）**

```typescript
it('AC-17: returns 401 without valid JWT', async () => {
  const dbUrl = await dbManager.createDatabase('doc_401')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a17@gofer.bot', password: 'Test1234!', name: 'A17' })
  const token = await AuthFixtures.loginAs(app, { email: 'a17@gofer.bot', password: 'Test1234!' })
  const kb = await createKnowledgeBase(app, token)

  // 无 Authorization header
  const res = await app.inject({
    method: 'GET',
    url: `/api/knowledge-bases/${kb.id}/documents`,
  })
  expect(res.statusCode).toBe(401)
  const body = res.json()
  expect(body.error.code).toBe('AUTH_ERROR')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

it('AC-18: returns 403 for non-owner access', async () => {
  const dbUrl = await dbManager.createDatabase('doc_403')
  const app = await TestAppFactory.create(dbUrl)

  // 用户 A 创建知识库
  const userA = await AuthFixtures.createUser(app, { email: 'owner@gofer.bot', password: 'Test1234!', name: 'Owner' })
  const tokenA = await AuthFixtures.loginAs(app, { email: 'owner@gofer.bot', password: 'Test1234!' })
  const kb = await createKnowledgeBase(app, tokenA)

  // 用户 B 尝试访问
  const userB = await AuthFixtures.createUser(app, { email: 'intruder@gofer.bot', password: 'Test1234!', name: 'Intruder' })
  const tokenB = await AuthFixtures.loginAs(app, { email: 'intruder@gofer.bot', password: 'Test1234!' })

  const res = await app.inject({
    method: 'GET',
    url: `/api/knowledge-bases/${kb.id}/documents`,
    headers: { authorization: `Bearer ${tokenB}` },
  })
  expect(res.statusCode).toBe(403)
  const body = res.json()
  expect(body.error.code).toBe('FORBIDDEN')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-03-document-api-testing/document.spec.ts --reporter=verbose`
预期：FAIL — 401/403 错误码验证失败

- [ ] **步骤 3: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-03-document-api-testing/document.spec.ts --reporter=verbose`
预期：PASS — AC-17~AC-18 通过

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-03-document-api-testing/document.spec.ts
git commit -m "test(b-03): AC-17~AC-18 authentication and authorization tests"
```

---

## 任务 7: AC-19 ~ AC-21 — 资源不存在测试

**文件：**
- 修改：`tests/issues/b-03-document-api-testing/document.spec.ts`

**规格引用：**
- API 规格：[404 知识库不存在]、[404 文档不存在]、[404 docId 格式非法]

- [ ] **步骤 1: 编写失败测试（AC-19 ~ AC-21）**

```typescript
it('AC-19: returns 404 for non-existent knowledge base', async () => {
  const dbUrl = await dbManager.createDatabase('doc_404_kb')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a19@gofer.bot', password: 'Test1234!', name: 'A19' })
  const token = await AuthFixtures.loginAs(app, { email: 'a19@gofer.bot', password: 'Test1234!' })

  const fakeKbId = '00000000-0000-0000-0000-000000000000'
  const res = await app.inject({
    method: 'GET',
    url: `/api/knowledge-bases/${fakeKbId}/documents`,
    headers: { authorization: `Bearer ${token}` },
  })
  expect(res.statusCode).toBe(404)
  const body = res.json()
  expect(body.error.code).toBe('NOT_FOUND')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

it('AC-20: returns 404 for non-existent document', async () => {
  const dbUrl = await dbManager.createDatabase('doc_404_doc')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a20@gofer.bot', password: 'Test1234!', name: 'A20' })
  const token = await AuthFixtures.loginAs(app, { email: 'a20@gofer.bot', password: 'Test1234!' })
  const kb = await createKnowledgeBase(app, token)

  const fakeDocId = '00000000-0000-0000-0000-000000000000'
  const res = await app.inject({
    method: 'PATCH',
    url: `/api/knowledge-bases/${kb.id}/documents/${fakeDocId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'new-name' },
  })
  expect(res.statusCode).toBe(404)
  const body = res.json()
  expect(body.error.code).toBe('NOT_FOUND')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

it('AC-21: returns 404 for invalid docId format', async () => {
  const dbUrl = await dbManager.createDatabase('doc_404_format')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a21@gofer.bot', password: 'Test1234!', name: 'A21' })
  const token = await AuthFixtures.loginAs(app, { email: 'a21@gofer.bot', password: 'Test1234!' })
  const kb = await createKnowledgeBase(app, token)

  const res = await app.inject({
    method: 'DELETE',
    url: `/api/knowledge-bases/${kb.id}/documents/not-a-uuid`,
    headers: { authorization: `Bearer ${token}` },
  })
  // NestJS 路由参数不匹配时，路由不会被命中，返回 404
  expect(res.statusCode).toBe(404)

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-03-document-api-testing/document.spec.ts --reporter=verbose`
预期：FAIL — 404 错误码验证失败

- [ ] **步骤 3: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-03-document-api-testing/document.spec.ts --reporter=verbose`
预期：PASS — AC-19~AC-21 通过

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-03-document-api-testing/document.spec.ts
git commit -m "test(b-03): AC-19~AC-21 not-found error tests"
```

---

## 任务 8: 最终验证与清理

**文件：**
- 修改：`tests/issues/b-03-document-api-testing/document.spec.ts`（如有清理需求）

- [ ] **步骤 1: 全量运行测试**

运行：`npx vitest run tests/issues/b-03-document-api-testing/document.spec.ts --reporter=verbose`
预期：PASS — 21/21 测试全部通过

- [ ] **步骤 2: 运行相关测试无回归**

运行：`npx vitest run tests/issues/i-01-testing-infra-setup/ tests/issues/b-02-auth-api-testing/ --reporter=verbose`
预期：PASS — 已有测试不受影响

- [ ] **步骤 3: 类型检查**

运行：`pnpm type-check`
预期：0 错误

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-03-document-api-testing/
git commit -m "test(b-03): complete DocumentController integration tests (21 ACs)"
```

---

## 自检

### 规格覆盖检查

| Spec 需求 | 对应任务 | 状态 |
|-----------|----------|------|
| GET list 正常 | 任务 2, AC-01 | ✅ |
| POST upload 正常 | 任务 2, AC-02 | ✅ |
| POST create 正常 | 任务 2, AC-03 | ✅ |
| PATCH update 正常 | 任务 2, AC-04 | ✅ |
| DELETE remove 正常 | 任务 2, AC-05 | ✅ |
| 空列表 | 任务 2, AC-06 | ✅ |
| folderId 筛选 | 任务 3, AC-07 | ✅ |
| 空 body 更新 | 任务 3, AC-08 | ✅ |
| name 为空 | 任务 4, AC-09 | ✅ |
| name 超长 | 任务 4, AC-10 | ✅ |
| folderId 非法 (body) | 任务 4, AC-11 | ✅ |
| folderId 非法 (query) | 任务 4, AC-12 | ✅ |
| 文件超过 50MB | 任务 5, AC-13 | ✅ |
| 不支持文件类型 | 任务 5, AC-14 | ✅ |
| 非法文件名 | 任务 5, AC-15 | ✅ |
| 空文件 (0 bytes) | 任务 5, AC-16 | ✅ |
| 未认证 | 任务 6, AC-17 | ✅ |
| 非所有者 | 任务 6, AC-18 | ✅ |
| 知识库不存在 | 任务 7, AC-19 | ✅ |
| 文档不存在 | 任务 7, AC-20 | ✅ |
| docId 格式非法 | 任务 7, AC-21 | ✅ |

### 占位符扫描

- [x] 无 "TBD" / "TODO" / "稍后实现"
- [x] 无 "添加适当的错误处理" 等模糊描述
- [x] 无 "类似于任务 N" 的引用
- [x] 每个任务都有具体代码块
- [x] 每个任务都以测试开始，以测试通过结束

### 类型一致性

- [x] `createKnowledgeBase` 和 `buildMultipartPayload` 签名在所有任务中一致
- [x] 响应体解析模式 `body.data ? body.data : body` 统一
- [x] 数据库清理模式统一
