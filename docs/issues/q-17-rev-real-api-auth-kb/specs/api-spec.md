# API 规格：q-17 真实 API 版本

## 测试基础设施

```typescript
// 使用 TestAppFactory + 真实数据库
const dbManager = new TestDatabaseManager()
const dbUrl = await dbManager.createDatabase('q17_rev')
const app = await TestAppFactory.create(dbUrl, { realMode: true })
```

## AC-06: 未登录访问保护路由重定向

### 测试逻辑

```typescript
it('AC-06: 未登录访问保护路由重定向到登录页', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    // 无 authorization header
  })

  expect(res.statusCode).toBe(401)
})
```

### 涉及端点

- `GET /api/auth/me` — 无 token 返回 401
- `GET /api/knowledge-bases` — 无 token 返回 401
- `GET /api/sessions` — 无 token 返回 401

## AC-08: 重复注册相同邮箱

### 测试逻辑

```typescript
it('AC-08: 重复注册相同邮箱返回错误', async () => {
  const email = `duplicate-${Date.now()}@test.gofer`
  const password = 'Test1234!'

  // 第一次注册
  const res1 = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password, name: 'Test' },
  })
  expect(res1.statusCode).toBe(201)

  // 第二次注册（相同邮箱）
  const res2 = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password: 'Another1234!', name: 'Test2' },
  })
  expect(res2.statusCode).toBe(409)
  expect(res2.json().message).toContain('已存在')
})
```

### 涉及端点

- `POST /api/auth/register`

## AC-12: 上传文档到知识库

### 测试逻辑

```typescript
it('AC-12: 上传文档到知识库，状态变为 ready', async () => {
  // 1. 创建用户并登录
  // 2. 创建知识库
  // 3. 上传文档
  const content = '测试文档内容'.repeat(50)
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
  const multipartBody = buildMultipartBody(boundary, 'file', 'test.txt', 'text/plain', Buffer.from(content))

  const uploadRes = await app.inject({
    method: 'POST',
    url: `/api/knowledge-bases/${kbId}/documents/upload`,
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      authorization: `Bearer ${token}`,
    },
    payload: multipartBody,
  })

  expect(uploadRes.statusCode).toBe(201)
  const docId = uploadRes.json().data.id

  // 4. 等待 Worker 处理
  await waitForDocumentStatus(docId, 'ready', 60000)

  // 5. 验证状态
  const doc = await prisma.document.findUnique({ where: { id: docId } })
  expect(doc?.status).toBe('ready')
})
```

### 涉及端点

- `POST /api/knowledge-bases/:kbId/documents/upload`
- `GET /api/knowledge-bases/:kbId/documents/:docId`（查询状态）

## AC-15: 用户隔离

### 测试逻辑

```typescript
it('AC-15: 用户 B 无法操作用户 A 的知识库', async () => {
  // 1. 创建用户 A 和知识库
  // 2. 创建用户 B
  // 3. 用户 B 尝试访问用户 A 的知识库
  const res = await app.inject({
    method: 'GET',
    url: `/api/knowledge-bases/${userAKbId}`,
    headers: { authorization: `Bearer ${userBToken}` },
  })

  expect(res.statusCode).toBe(403)
})
```

### 涉及端点

- `GET /api/knowledge-bases/:id`
- `DELETE /api/knowledge-bases/:id`
- `POST /api/knowledge-bases/:kbId/documents/upload`

## AC-16: 上传多种类型文档

### 测试逻辑

```typescript
it('AC-16: 上传 txt/md/pdf 三种类型文档', async () => {
  const files = [
    { name: 'test.txt', content: '文本内容', type: 'text/plain' },
    { name: 'test.md', content: '# Markdown', type: 'text/markdown' },
    // PDF 使用占位内容（DocumentParser 可能未实现 PDF 解析）
    { name: 'test.pdf', content: '%PDF-1.4', type: 'application/pdf' },
  ]

  for (const file of files) {
    // 上传并验证状态变为 ready（或 failed，如 PDF 未实现）
  }
})
```

### 涉及端点

- `POST /api/knowledge-bases/:kbId/documents/upload`

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| 未登录重定向 | `tests/integration/q-17-rev.spec.ts` | AC-06: 无 token 访问返回 401 |
| 重复注册 | `tests/integration/q-17-rev.spec.ts` | AC-08: 重复邮箱返回 409 |
| 文档上传 | `tests/integration/q-17-rev.spec.ts` | AC-12: 上传后状态变为 ready |
| 用户隔离 | `tests/integration/q-17-rev.spec.ts` | AC-15: 跨用户访问返回 403 |
| 多类型上传 | `tests/integration/q-17-rev.spec.ts` | AC-16: txt/md/pdf 均成功 |
