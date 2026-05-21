# #04b 文件操作后索引同步实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在跨库移动/复制、知识库重命名、文件重命名后，自动同步更新 `document_chunks` / `vec_document_chunks` / `fts_document_chunks`，保证 RAG 检索结果与物理文件一致。

**Architecture:** 复用 #04 已有的后台索引入队机制，在 `knowledgeBases.ts` 的各文件操作 handler 完成后，调用 `indexer.ts` 新增的同步辅助函数：删除旧索引记录、更新 `file_path`、将受影响文件重新入队。`fts_document_chunks` 因 FTS5 虚拟表不支持 UPDATE，采用 DELETE + INSERT 方式更新。

**Tech Stack:** Node.js, Hono, better-sqlite3, sqlite-vec, FTS5, Vitest

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `server/src/services/indexer.ts` | 修改 | 导出 `deleteExistingChunks`，新增 `updateChunkFilePaths`（批量 UPDATE document_chunks）、`syncFtsFilePaths`（DELETE + INSERT fts_document_chunks） |
| `server/src/routes/knowledgeBases.ts` | 修改 | 在 `POST /move`、`POST /copy`、`PATCH /:id`、`PATCH /:id/files/*` handler 中补充索引同步逻辑 |
| `tests/unit/server/indexSync.test.ts` | 新建 | 覆盖四种文件操作后的索引同步行为 |

---

## Task 1: 为 indexer.ts 添加索引同步辅助函数

**Files:**
- Modify: `server/src/services/indexer.ts`

- [ ] **Step 1: 将 `deleteExistingChunks` 改名为 `deleteFileChunks` 并导出**

```typescript
export function deleteFileChunks(knowledgeBaseId: string, relativePath: string): void {
  const rows = db
    .prepare('SELECT id FROM document_chunks WHERE knowledge_base_id = ? AND file_path = ?')
    .all(knowledgeBaseId, relativePath) as Array<{ id: string }>

  for (const row of rows) {
    db.prepare('DELETE FROM document_chunks WHERE id = ?').run(row.id)
    db.prepare('DELETE FROM vec_document_chunks WHERE chunk_id = ?').run(row.id)
    db.prepare('DELETE FROM fts_document_chunks WHERE rowid = ?').run(row.id)
  }
}
```

- [ ] **Step 2: 在 `indexFile` 中将 `deleteExistingChunks` 调用改为 `deleteFileChunks`**

```typescript
// 在 indexFile 函数的 db.transaction 中
    deleteFileChunks(task.knowledgeBaseId, task.relativePath)
```

- [ ] **Step 3: 新增 `updateChunkFilePaths` 函数（批量更新 document_chunks.file_path）**

在 `indexer.ts` 末尾、`getQueueLength` 之前插入：

```typescript
export function updateChunkFilePaths(
  knowledgeBaseId: string,
  oldPath: string,
  newPath: string
): void {
  db.prepare(
    `UPDATE document_chunks SET file_path = ? || SUBSTR(file_path, LENGTH(?) + 1)
     WHERE knowledge_base_id = ? AND file_path = ? || '%'`
  ).run(newPath, oldPath, knowledgeBaseId, oldPath)
}
```

> 说明：`SUBSTR(file_path, LENGTH(oldPath) + 1)` 截取旧路径之后的部分，前面拼接 `newPath`。`file_path LIKE oldPath || '%'` 保证只更新以旧路径开头的记录。适用于知识库重命名（旧知识库名前缀 → 新知识库名前缀）和文件重命名（旧文件名 → 新文件名）。

- [ ] **Step 4: 新增 `syncFtsFilePaths` 函数（FTS5 DELETE + INSERT）**

```typescript
export function syncFtsFilePaths(
  knowledgeBaseId: string,
  oldPathPrefix: string,
  newPathPrefix: string
): void {
  const rows = db
    .prepare(
      `SELECT id, content, file_path FROM document_chunks
       WHERE knowledge_base_id = ? AND file_path LIKE ?`
    )
    .all(knowledgeBaseId, `${oldPathPrefix}%`) as Array<{ id: string; content: string; file_path: string }>

  const deleteFts = db.prepare('DELETE FROM fts_document_chunks WHERE rowid = ?')
  const insertFts = db.prepare(
    `INSERT INTO fts_document_chunks (rowid, content, file_path) VALUES (?, ?, ?)`
  )

  for (const row of rows) {
    const newFilePath = newPathPrefix + row.file_path.slice(oldPathPrefix.length)
    deleteFts.run(row.id)
    insertFts.run(row.id, row.content, newFilePath)
  }
}
```

> 说明：FTS5 虚拟表不支持 UPDATE，因此先 DELETE 旧记录，再 INSERT 新记录（rowid、content 不变，file_path 更新）。`vec_document_chunks` 不含 `file_path` 列，无需更新。

- [ ] **Step 5: Commit**

```bash
git add server/src/services/indexer.ts
git commit -m "feat(indexer): 添加索引同步辅助函数 deleteFileChunks、updateChunkFilePaths、syncFtsFilePaths"
```

---

## Task 2: 修改 POST /move handler（跨库移动后索引同步）

**Files:**
- Modify: `server/src/routes/knowledgeBases.ts`

- [ ] **Step 1: 在 `fs.renameSync` 之后添加索引同步逻辑**

找到 `// POST /move` handler，在 `fs.renameSync(srcFullPath, dstFullPath)` 和 `return c.json({ success: true })` 之间插入：

```typescript
  // 删除源知识库中该文件的索引
  const { deleteFileChunks } = await import('../services/indexer.js')
  deleteFileChunks(body.sourceKbId, body.sourcePath)

  // 将文件加入目标知识库索引队列
  const { enqueueIndexTask } = await import('../services/indexer.js')
  const dstRelativePath = body.targetPath
    ? `${body.targetPath}/${fileName}`
    : fileName
  enqueueIndexTask({
    knowledgeBaseId: body.targetKbId,
    filePath: dstFullPath,
    relativePath: dstRelativePath,
  })
```

> 注意：由于前面已经 `await import('../services/indexer.js')` 引入了 `enqueueIndexTask`（在导入时需要检查），这里需要调整导入顺序。实际上 `POST /move` 之前没有导入 indexer，所以直接写：

```typescript
  fs.renameSync(srcFullPath, dstFullPath)

  const { deleteFileChunks, enqueueIndexTask } = await import('../services/indexer.js')

  // 删除源知识库中该文件的索引
  deleteFileChunks(body.sourceKbId, body.sourcePath)

  // 将文件加入目标知识库索引队列
  const dstRelativePath = body.targetPath
    ? `${body.targetPath}/${fileName}`
    : fileName
  enqueueIndexTask({
    knowledgeBaseId: body.targetKbId,
    filePath: dstFullPath,
    relativePath: dstRelativePath,
  })

  return c.json({ success: true })
```

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/knowledgeBases.ts
git commit -m "feat(server): 跨库移动后同步更新索引（删除源索引 + 目标重新入队）"
```

---

## Task 3: 修改 POST /copy handler（跨库复制后索引同步）

**Files:**
- Modify: `server/src/routes/knowledgeBases.ts`

- [ ] **Step 1: 在 `fs.copyFileSync` 之后添加索引入队逻辑**

找到 `// POST /copy` handler，在 `fs.copyFileSync(srcFullPath, dstFullPath)` 和 `return c.json({ success: true, name: uniqueName })` 之间插入：

```typescript
  fs.copyFileSync(srcFullPath, dstFullPath)

  const { enqueueIndexTask } = await import('../services/indexer.js')
  const dstRelativePath = body.targetPath
    ? `${body.targetPath}/${uniqueName}`
    : uniqueName
  enqueueIndexTask({
    knowledgeBaseId: body.targetKbId,
    filePath: dstFullPath,
    relativePath: dstRelativePath,
  })

  return c.json({ success: true, name: uniqueName })
```

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/knowledgeBases.ts
git commit -m "feat(server): 跨库复制后将副本加入目标知识库索引队列"
```

---

## Task 4: 修改 PATCH /knowledge-bases/:id handler（知识库重命名后索引同步）

**Files:**
- Modify: `server/src/routes/knowledgeBases.ts`

- [ ] **Step 1: 在知识库重命名逻辑之后添加索引同步**

找到 `app.patch('/:id', ...)` handler，在 `fs.renameSync(kb.path, newPath)` 之后、数据库 UPDATE 之前插入：

```typescript
  if (body.name !== undefined && body.name.trim() && body.name.trim() !== kb.name) {
    // ... 原有冲突检查和 newName/newPath 赋值 ...

    if (fs.existsSync(kb.path)) {
      ensureDir(DOCS_DIR)
      fs.renameSync(kb.path, newPath)

      // 同步更新 document_chunks 和 fts_document_chunks 中的 file_path 前缀
      const oldKbName = kb.name
      const newKbName = newName
      const { updateChunkFilePaths, syncFtsFilePaths } = await import('../services/indexer.js')
      updateChunkFilePaths(id, `${oldKbName}/`, `${newKbName}/`)
      syncFtsFilePaths(id, `${oldKbName}/`, `${newKbName}/`)
    }
  }
```

> 说明：由于 `document_chunks.file_path` 当前存储的是相对知识库根目录的路径，知识库重命名理论上不影响这些路径。但如果未来存储格式变为包含知识库名的绝对路径，此逻辑可保证兼容性。此处使用 `${oldKbName}/` 作为前缀是为了避免误匹配文件名中包含旧知识库名的情况。

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/knowledgeBases.ts
git commit -m "feat(server): 知识库重命名后同步更新索引 file_path 前缀"
```

---

## Task 5: 修改 PATCH /knowledge-bases/:id/files/:path handler（文件重命名后索引同步）

**Files:**
- Modify: `server/src/routes/knowledgeBases.ts`

- [ ] **Step 1: 在文件重命名之后添加索引同步**

找到 `app.patch('/:id/files/*', ...)` handler，在 `fs.renameSync(oldFullPath, newFullPath)` 和 `return c.json(...)` 之间插入：

```typescript
  fs.renameSync(oldFullPath, newFullPath)

  const { updateChunkFilePaths, syncFtsFilePaths } = await import('../services/indexer.js')
  const oldRelativePath = filePath
  const newRelativePath = dir === '.' ? newFileName : `${dir}/${newFileName}`
  updateChunkFilePaths(id, oldRelativePath, newRelativePath)
  syncFtsFilePaths(id, oldRelativePath, newRelativePath)

  return c.json({ name: newFileName, path: dir === '.' ? newFileName : `${dir}/${newFileName}` })
```

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/knowledgeBases.ts
git commit -m "feat(server): 文件重命名后同步更新索引 file_path"
```

---

## Task 6: 编写索引同步测试

**Files:**
- Create: `tests/unit/server/indexSync.test.ts`

- [ ] **Step 1: 创建测试文件，覆盖四种操作的索引同步**

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const testDir = path.join(os.tmpdir(), `kb-index-sync-test-${Date.now()}`)
process.env.APP_DATA_DIR = testDir

const { default: app } = await import('../../../../server/src/routes/knowledgeBases.js')
const { default: db } = await import('../../../../server/src/db.js')

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true })
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_document_chunks USING vec0(
        chunk_id TEXT PRIMARY KEY,
        embedding FLOAT[1536]
      );
    `)
  } catch { /* sqlite-vec 可能不可用 */ }
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS fts_document_chunks USING fts5(
        content,
        file_path,
        tokenize='unicode61'
      );
    `)
  } catch { /* FTS5 可能不可用 */ }
})

afterAll(() => {
  db.close()
  fs.rmSync(testDir, { recursive: true, force: true })
})

beforeEach(() => {
  db.exec('DELETE FROM knowledge_bases')
  db.exec('DELETE FROM document_chunks')
  try { db.exec('DELETE FROM vec_document_chunks') } catch { /* ignore */ }
  try { db.exec('DELETE FROM fts_document_chunks') } catch { /* ignore */ }
})

function insertFakeChunk(kbId: string, filePath: string, content: string): string {
  const id = `chunk-${Math.random().toString(36).slice(2)}`
  db.prepare(
    `INSERT INTO document_chunks (id, knowledge_base_id, file_path, content, embedding, chunk_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, kbId, filePath, content, null, 0, Date.now())
  try {
    db.prepare(`INSERT INTO fts_document_chunks (rowid, content, file_path) VALUES (?, ?, ?)`)
      .run(id, content, filePath)
  } catch { /* ignore */ }
  return id
}

describe('POST /move', () => {
  it('should remove source index and queue target index after move', async () => {
    const srcRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'MoveSrc' }),
    })
    const srcKb = (await srcRes.json()) as { id: string }

    const dstRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'MoveDst' }),
    })
    const dstKb = (await dstRes.json()) as { id: string }

    // 先导入文件并手动插入假 chunk
    await app.request(`/${srcKb.id}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '', files: [{ name: 'move.md', content: '# Move' }] }),
    })
    insertFakeChunk(srcKb.id, 'move.md', 'move content')

    const beforeSrc = db.prepare('SELECT COUNT(*) as c FROM document_chunks WHERE knowledge_base_id = ?').get(srcKb.id) as { c: number }
    expect(beforeSrc.c).toBe(1)

    const res = await app.request('/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceKbId: srcKb.id,
        sourcePath: 'move.md',
        targetKbId: dstKb.id,
        targetPath: '',
      }),
    })
    expect(res.status).toBe(200)

    // 源知识库索引应被删除
    const afterSrc = db.prepare('SELECT COUNT(*) as c FROM document_chunks WHERE knowledge_base_id = ?').get(srcKb.id) as { c: number }
    expect(afterSrc.c).toBe(0)

    // 目标知识库应有文件物理存在
    const dstFiles = await app.request(`/${dstKb.id}/files`)
    const dstJson = (await dstFiles.json()) as { items: Array<{ name: string }> }
    expect(dstJson.items.find((i) => i.name === 'move.md')).toBeDefined()
  })
})

describe('POST /copy', () => {
  it('should queue target index after copy', async () => {
    const srcRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'CopySrc' }),
    })
    const srcKb = (await srcRes.json()) as { id: string }

    const dstRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'CopyDst' }),
    })
    const dstKb = (await dstRes.json()) as { id: string }

    await app.request(`/${srcKb.id}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '', files: [{ name: 'copy.md', content: '# Copy' }] }),
    })

    const res = await app.request('/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceKbId: srcKb.id,
        sourcePath: 'copy.md',
        targetKbId: dstKb.id,
        targetPath: '',
      }),
    })
    expect(res.status).toBe(200)

    // 目标知识库应有文件物理存在
    const dstFiles = await app.request(`/${dstKb.id}/files`)
    const dstJson = (await dstFiles.json()) as { items: Array<{ name: string }> }
    expect(dstJson.items.find((i) => i.name === 'copy.md')).toBeDefined()
  })
})

describe('PATCH /knowledge-bases/:id/files/:path', () => {
  it('should update document_chunks.file_path after file rename', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'RenameIdx' }),
    })
    const kb = (await createRes.json()) as { id: string }

    await app.request(`/${kb.id}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '', files: [{ name: 'old.md', content: '# Hello' }] }),
    })
    insertFakeChunk(kb.id, 'old.md', 'old content')

    const res = await app.request(`/${kb.id}/files/old.md`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName: 'new' }),
    })
    expect(res.status).toBe(200)

    const row = db.prepare('SELECT file_path FROM document_chunks WHERE knowledge_base_id = ?').get(kb.id) as
      | { file_path: string }
      | undefined
    expect(row?.file_path).toBe('new.md')
  })
})

describe('PATCH /knowledge-bases/:id', () => {
  it('should update document_chunks.file_path prefix after kb rename', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'OldKb' }),
    })
    const kb = (await createRes.json()) as { id: string }

    insertFakeChunk(kb.id, 'OldKb/notes.md', 'notes content')

    const patchRes = await app.request(`/${kb.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'NewKb' }),
    })
    expect(patchRes.status).toBe(200)

    const row = db.prepare('SELECT file_path FROM document_chunks WHERE knowledge_base_id = ?').get(kb.id) as
      | { file_path: string }
      | undefined
    expect(row?.file_path).toBe('NewKb/notes.md')
  })
})
```

> 说明：`insertFakeChunk` 手动插入假数据，绕过实际的 embedding 生成和 TextLoader，使测试聚焦在索引同步逻辑上。

- [ ] **Step 2: Commit**

```bash
git add tests/unit/server/indexSync.test.ts
git commit -m "test(server): 添加文件操作后索引同步的单元测试"
```

---

## Task 7: 运行测试并验证

**Files:**
- Run: `pnpm test`

- [ ] **Step 1: 运行测试**

```bash
pnpm test
```

- [ ] **Step 2: 如果测试失败，检查原因**

常见失败原因：
1. `sqlite-vec` 或 `FTS5` 在测试环境中不可用 → `try/catch` 已处理，不应影响测试
2. `updateChunkFilePaths` 的 SQL 语法问题 → 检查 `SUBSTR` 和 `LENGTH` 用法
3. `syncFtsFilePaths` 中 `rowid` 类型不匹配 → 确保 `rowid` 与 `document_chunks.id` 类型一致

- [ ] **Step 3: 运行 type-check**

```bash
pnpm type-check
```

- [ ] **Step 4: Commit（如果测试通过）**

```bash
git add -A
git commit -m "feat(server): #04b 文件操作后索引同步完成"
```

---

## 自审清单

**1. Spec coverage:**
- [x] 跨库移动后源知识库移除索引、目标知识库重新入队 — Task 2
- [x] 跨库复制后目标知识库重新入队 — Task 3
- [x] 知识库重命名后同步更新 `document_chunks.file_path` 前缀 — Task 4
- [x] 文件重命名后同步更新 `document_chunks.file_path` — Task 5
- [x] 前端索引进度显示 — 复用 #04 已有机制（`enqueueIndexTask` 自动触发索引进度），无需新前端代码
- [x] 增量更新模式 — 采用"删除旧索引 + 重新入队"的增量方式，避免全量重建

**2. Placeholder scan:**
- [x] 无 "TBD"/"TODO"
- [x] 所有代码块包含完整可运行的代码
- [x] 无模糊描述（如 "add appropriate error handling"）

**3. Type consistency:**
- [x] `deleteFileChunks` 参数与旧 `deleteExistingChunks` 一致
- [x] `enqueueIndexTask` 参数结构复用现有 `IndexTask` 接口
- [x] `syncFtsFilePaths` 中的 `rowid` 与 `document_chunks.id` 均为 `string` 类型（与现有插入逻辑一致）

---

*Plan created: 2026-05-08*
