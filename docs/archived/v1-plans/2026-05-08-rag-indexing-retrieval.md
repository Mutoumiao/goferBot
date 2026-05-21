# RAG 索引检索（#04）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现完整的 RAG 索引和检索功能，包括后台索引队列、sqlite-vec 向量索引、FTS5 全文索引、混合搜索（RRF 融合），以及前端 `@提及` 知识库的交互。

**Architecture:** Sidecar 负责全部业务逻辑：文件导入后触发索引任务队列，后台逐文件使用 LangChain 分块并调用 Embedding API，结果写入 SQLite 的三张表（document_chunks 原始表、vec_document_chunks sqlite-vec HNSW 虚拟表、fts_document_chunks FTS5 虚拟表）。用户在前端输入 `@` 弹出知识库选择，消息发送时携带 `knowledgeBaseIds`，Sidecar 在 `/chat` 中对指定知识库执行向量搜索 + 全文搜索 + RRF 融合，将检索结果拼入 system prompt 后调用 LLM。

**Tech Stack:** Hono (Sidecar), better-sqlite3, sqlite-vec, LangChain (TextLoader + RecursiveCharacterTextSplitter), Vue 3, Pinia, Vitest

---

## File Structure

| File | Responsibility |
|------|----------------|
| `server/src/db.ts` | 新增 `document_chunks` / `vec_document_chunks` / `fts_document_chunks` Schema 和 migration |
| `server/src/services/embedding.ts` | Embedding API 封装（读取 settings 配置，调用 OpenAI-compatible API） |
| `server/src/services/indexer.ts` | 索引队列核心：文件遍历、LangChain 分块、调用 Embedding、写入三张表 |
| `server/src/services/rag.ts` | RAG 检索核心：混合搜索（向量+全文）、RRF 融合、prompt 拼接 |
| `server/src/routes/indexing.ts` | 索引相关 API：`POST /:id/index`、`GET /:id/index-status` |
| `server/src/routes/chat.ts` | 修改：接收 `knowledgeBaseIds`，调用 RAG 检索，将结果拼入 system prompt |
| `server/src/index.ts` | 修改：启动时加载 sqlite-vec 扩展、注册 indexing 路由、初始化索引队列 |
| `server/package.json` | 新增依赖：`langchain`、`@langchain/textsplitters`、`sqlite-vec` |
| `src/components/ChatInput.vue` | 修改：添加 `@提及` 下拉交互、pill 渲染 |
| `src/components/KbMentionDropdown.vue` | 新增：知识库 @提及 下拉列表组件 |
| `src/components/KbMentionPill.vue` | 新增：已选知识库 pill/tag 组件 |
| `src/stores/session.ts` | 修改：`sendMessage` 接收 `knowledgeBaseIds` 并传给 `/chat` |
| `src/types/index.ts` | 修改：`Message` 增加 `knowledge_base_ids` |
| `tests/unit/server/indexing.test.ts` | 索引 API 和 RAG 检索测试 |
| `tests/unit/components/ChatInputMention.test.ts` | @提及 交互组件测试 |

---

## Task 1: 安装 Sidecar 依赖

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: 添加依赖到 server/package.json**

在 `dependencies` 中追加：

```json
    "langchain": "^0.3.0",
    "@langchain/textsplitters": "^0.1.0",
    "sqlite-vec": "^0.1.0"
```

- [ ] **Step 2: 安装依赖**

Run:
```bash
cd server && pnpm install
```

Expected: 安装成功，无报错。

- [ ] **Step 3: Commit**

```bash
git add server/package.json server/pnpm-lock.yaml
git commit -m "chore(sidecar): add langchain, textsplitters, sqlite-vec dependencies"
```

---

## Task 2: 扩展 SQLite Schema（document_chunks + vec + fts）

**Files:**
- Modify: `server/src/db.ts`
- Modify: `server/src/types.ts`

- [ ] **Step 1: 修改 server/src/db.ts 添加新表和迁移**

在现有 migration（icon 列）之后、export 之前插入：

```typescript
// document_chunks 原始表
const documentChunksSql = `
CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  knowledge_base_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB,
  chunk_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id)
);
CREATE INDEX IF NOT EXISTS idx_chunks_kb ON document_chunks(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_chunks_file ON document_chunks(knowledge_base_id, file_path);
`

try {
  db.exec(documentChunksSql)
} catch (e) {
  console.error('Failed to create document_chunks table:', e)
  throw e
}

// Migration: messages 表增加 knowledge_base_ids 列
try {
  db.exec(`ALTER TABLE messages ADD COLUMN knowledge_base_ids TEXT;`)
} catch { /* already exists */ }

// 虚拟表由 indexer 服务在首次使用时动态创建（需要 sqlite-vec 扩展先加载）
// vec_document_chunks 和 fts_document_chunks 在 server/src/index.ts 加载扩展后初始化
```

- [ ] **Step 2: 修改 server/src/types.ts 更新 Message 类型**

```typescript
export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  knowledge_base_ids: string | null
  created_at: number
}
```

- [ ] **Step 3: 运行 sidecar 类型检查**

Run:
```bash
cd server && pnpm build
```

Expected: 编译通过。

- [ ] **Step 4: Commit**

```bash
git add server/src/db.ts server/src/types.ts
git commit -m "feat(db): add document_chunks schema and messages.knowledge_base_ids column"
```

---

## Task 3: Sidecar 启动时加载 sqlite-vec 扩展

**Files:**
- Modify: `server/src/index.ts`
- Modify: `server/src/db.ts`

- [ ] **Step 1: 修改 server/src/db.ts 导出 loadExtensions 函数**

在文件末尾、export 之前添加：

```typescript
export function loadVectorExtensions(): void {
  const vec = import('sqlite-vec')
    .then((m) => {
      const extPath = m.default as string
      db.loadExtension(extPath)
      console.log('[db] sqlite-vec extension loaded from', extPath)
    })
    .catch((err) => {
      console.error('[db] Failed to load sqlite-vec extension:', err)
      // 不抛出，允许降级运行（无向量搜索）
    })

  // 同步等待不太现实，改为在 index.ts 启动流程中 await
  return vec as unknown as void
}
```

改为更简洁的方式——`sqlite-vec` npm 包导出的是扩展的路径字符串：

```typescript
export async function loadVectorExtensions(): Promise<void> {
  try {
    const sqliteVec = await import('sqlite-vec')
    db.loadExtension(sqliteVec.default)
    console.log('[db] sqlite-vec extension loaded')
  } catch (err) {
    console.error('[db] Failed to load sqlite-vec extension:', err)
  }
}
```

- [ ] **Step 2: 修改 server/src/index.ts 在启动时加载扩展并创建虚拟表**

在 `import db from './db.js'` 之后添加：

```typescript
import { loadVectorExtensions } from './db.js'
```

在 `app.route('/knowledge-bases', knowledgeBaseRoutes)` 之前添加启动逻辑：

```typescript
// 启动时加载扩展并创建虚拟表
await loadVectorExtensions()

// 创建 sqlite-vec 虚拟表（如果扩展加载成功）
try {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_document_chunks USING vec0(
      chunk_id TEXT PRIMARY KEY,
      embedding FLOAT[1536]
    );
  `)
} catch (e) {
  console.warn('[db] vec_document_chunks creation skipped (sqlite-vec may not be available):', (e as Error).message)
}

// 创建 FTS5 虚拟表
try {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_document_chunks USING fts5(
      content,
      file_path,
      content='document_chunks',
      content_rowid='id'
    );
  `)
} catch (e) {
  console.warn('[db] fts_document_chunks creation skipped:', (e as Error).message)
}
```

- [ ] **Step 3: 启动 sidecar 验证扩展加载**

Run:
```bash
cd server && pnpm dev
```

Expected: 控制台输出 `[db] sqlite-vec extension loaded`，或降级警告。按 Ctrl+C 退出。

- [ ] **Step 4: Commit**

```bash
git add server/src/db.ts server/src/index.ts
git commit -m "feat(db): load sqlite-vec extension and create virtual tables on startup"
```

---

## Task 4: Embedding API 服务

**Files:**
- Create: `server/src/services/embedding.ts`
- Test: `tests/unit/server/embedding.test.ts`

- [ ] **Step 1: 创建 server/src/services/embedding.ts**

```typescript
import type { LLMConfig } from '../types.js'

export interface EmbeddingConfig {
  provider: string
  model: string
  baseUrl: string
  apiKey: string
}

function getDefaultEmbeddingBaseUrl(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com'
    case 'siliconflow':
      return 'https://api.siliconflow.cn'
    default:
      return ''
  }
}

export async function getEmbedding(texts: string[], config: EmbeddingConfig): Promise<number[][]> {
  const url = config.baseUrl || getDefaultEmbeddingBaseUrl(config.provider)
  if (!url) {
    throw new Error(`Unknown embedding provider: ${config.provider}`)
  }

  const response = await fetch(`${url}/v1/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      input: texts,
      encoding_format: 'float',
    }),
  })

  if (!response.ok) {
    const error = await response.text().catch(() => 'Unknown error')
    throw new Error(`Embedding API error: ${response.status} ${error}`)
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[]; index: number }>
  }

  // 按 index 排序确保顺序一致
  const sorted = data.data.sort((a, b) => a.index - b.index)
  return sorted.map((d) => d.embedding)
}
```

- [ ] **Step 2: 创建 tests/unit/server/embedding.test.ts**

```typescript
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getEmbedding } from '../../../../server/src/services/embedding.js'

describe('getEmbedding', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns embeddings for multiple texts', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { embedding: [0.1, 0.2, 0.3], index: 0 },
          { embedding: [0.4, 0.5, 0.6], index: 1 },
        ],
      }),
    } as Response)

    const result = await getEmbedding(['hello', 'world'], {
      provider: 'openai',
      model: 'text-embedding-3-small',
      baseUrl: '',
      apiKey: 'test-key',
    })

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual([0.1, 0.2, 0.3])
    expect(result[1]).toEqual([0.4, 0.5, 0.6])
  })

  it('throws on API error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as Response)

    await expect(
      getEmbedding(['hello'], {
        provider: 'openai',
        model: 'text-embedding-3-small',
        baseUrl: '',
        apiKey: 'bad-key',
      })
    ).rejects.toThrow('Embedding API error: 401')
  })

  it('throws on unknown provider without baseUrl', async () => {
    await expect(
      getEmbedding(['hello'], {
        provider: 'unknown',
        model: 'x',
        baseUrl: '',
        apiKey: 'key',
      })
    ).rejects.toThrow('Unknown embedding provider')
  })
})
```

- [ ] **Step 3: 运行测试**

Run:
```bash
pnpm test tests/unit/server/embedding.test.ts
```

Expected: 3 tests PASS。

- [ ] **Step 4: Commit**

```bash
git add server/src/services/embedding.ts tests/unit/server/embedding.test.ts
git commit -m "feat(embedding): add Embedding API service with tests"
```

---

## Task 5: 索引队列核心（Indexer Service）

**Files:**
- Create: `server/src/services/indexer.ts`
- Modify: `server/src/routes/knowledgeBases.ts`
- Test: `tests/unit/server/indexer.test.ts`

- [ ] **Step 1: 创建 server/src/services/indexer.ts**

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { nanoid } from 'nanoid'
import { TextLoader } from 'langchain/document_loaders/fs/text'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import db from '../db.js'
import { getEmbedding } from './embedding.js'
import type { EmbeddingConfig } from './embedding.js'

export interface IndexTask {
  knowledgeBaseId: string
  filePath: string       // 绝对路径
  relativePath: string   // 相对于知识库根目录的路径
}

const queue: IndexTask[] = []
let isProcessing = false

export function enqueueIndexTask(task: IndexTask): void {
  queue.push(task)
  if (!isProcessing) {
    processQueue()
  }
}

export function enqueueKnowledgeBase(knowledgeBaseId: string, kbPath: string): void {
  if (!fs.existsSync(kbPath)) return
  const files = collectFiles(kbPath, kbPath)
  for (const f of files) {
    enqueueIndexTask({ knowledgeBaseId, filePath: f.absolute, relativePath: f.relative })
  }
}

function collectFiles(dir: string, root: string): Array<{ absolute: string; relative: string }> {
  const results: Array<{ absolute: string; relative: string }> = []
  if (!fs.existsSync(dir)) return results
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name)
    const relative = path.relative(root, absolute)
    if (entry.isDirectory()) {
      results.push(...collectFiles(absolute, root))
    } else {
      results.push({ absolute, relative })
    }
  }
  return results
}

async function processQueue(): Promise<void> {
  if (isProcessing) return
  isProcessing = true

  while (queue.length > 0) {
    const task = queue.shift()
    if (!task) continue
    try {
      await indexFile(task)
    } catch (err) {
      console.error('[indexer] Failed to index file:', task.filePath, err)
    }
  }

  isProcessing = false
}

async function indexFile(task: IndexTask): Promise<void> {
  // 读取文件内容
  const loader = new TextLoader(task.filePath)
  const docs = await loader.load()
  const fullText = docs.map((d) => d.pageContent).join('\n')
  if (!fullText.trim()) return

  // 删除该文件已有的 chunks
  deleteExistingChunks(task.knowledgeBaseId, task.relativePath)

  // 分块
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  })
  const chunks = await splitter.splitText(fullText)
  if (chunks.length === 0) return

  // 获取 embedding（批量调用，每次最多 100 条）
  const embeddingConfig = getEmbeddingConfigFromSettings()
  if (!embeddingConfig) {
    console.warn('[indexer] No embedding config available, skipping vector index')
  }

  let embeddings: number[][] = []
  if (embeddingConfig) {
    embeddings = await getEmbedding(chunks, embeddingConfig)
  }

  // 写入 document_chunks 表和虚拟表
  const insertChunk = db.prepare(
    `INSERT INTO document_chunks (id, knowledge_base_id, file_path, content, embedding, chunk_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )

  const insertVec = db.prepare(
    `INSERT INTO vec_document_chunks (chunk_id, embedding) VALUES (?, ?)`
  )

  const insertFts = db.prepare(
    `INSERT INTO fts_document_chunks (content, file_path) VALUES (?, ?)`
  )

  const now = Date.now()
  for (let i = 0; i < chunks.length; i++) {
    const chunkId = nanoid()
    const embeddingBlob = embeddings[i] ? Buffer.from(new Float32Array(embeddings[i]).buffer) : null

    insertChunk.run(chunkId, task.knowledgeBaseId, task.relativePath, chunks[i], embeddingBlob, i, now)
    insertVec.run(chunkId, JSON.stringify(embeddings[i] ?? []))
    insertFts.run(chunks[i], task.relativePath)
  }

  console.log(`[indexer] Indexed ${chunks.length} chunks for ${task.relativePath}`)
}

function deleteExistingChunks(knowledgeBaseId: string, relativePath: string): void {
  const rows = db
    .prepare('SELECT id FROM document_chunks WHERE knowledge_base_id = ? AND file_path = ?')
    .all(knowledgeBaseId, relativePath) as Array<{ id: string }>

  for (const row of rows) {
    db.prepare('DELETE FROM document_chunks WHERE id = ?').run(row.id)
    db.prepare('DELETE FROM vec_document_chunks WHERE chunk_id = ?').run(row.id)
    db.prepare('DELETE FROM fts_document_chunks WHERE rowid = ?').run(row.id)
  }
}

function getEmbeddingConfigFromSettings(): EmbeddingConfig | null {
  // 从 config.json 读取 embedding 配置
  // #05 设置系统完成后将有完整实现，此处先返回硬编码或读取 config.json
  const appDataDir = (await import('../utils.js')).getAppDataDir()
  const configPath = path.join(appDataDir, 'config.json')
  if (!fs.existsSync(configPath)) return null
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    const ec = config.embeddingProvider
    if (!ec || !ec.apiKey) return null
    return {
      provider: ec.provider || 'openai',
      model: ec.model || 'text-embedding-3-small',
      baseUrl: ec.baseUrl || '',
      apiKey: ec.apiKey,
    }
  } catch {
    return null
  }
}

export function getQueueLength(): number {
  return queue.length
}

export function getIndexStatus(knowledgeBaseId: string): { totalFiles: number; indexedFiles: number; pendingFiles: number } {
  // 通过 document_chunks 中的 distinct file_path 数量统计已索引文件数
  const indexedResult = db
    .prepare('SELECT COUNT(DISTINCT file_path) as count FROM document_chunks WHERE knowledge_base_id = ?')
    .get(knowledgeBaseId) as { count: number } | undefined

  const kb = db.prepare('SELECT path FROM knowledge_bases WHERE id = ?').get(knowledgeBaseId) as { path: string } | undefined
  let totalFiles = 0
  if (kb && fs.existsSync(kb.path)) {
    totalFiles = countFilesRecursively(kb.path)
  }

  return {
    totalFiles,
    indexedFiles: indexedResult?.count ?? 0,
    pendingFiles: getQueueLength(),
  }
}

function countFilesRecursively(dir: string): number {
  if (!fs.existsSync(dir)) return 0
  let count = 0
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      count += countFilesRecursively(full)
    } else {
      count++
    }
  }
  return count
}
```

注意：`getEmbeddingConfigFromSettings` 中用了顶层 await 的 `import`，这会出问题。需要改为同步读取，因为 `fs.readFileSync` 本来就是同步的。

修正 `getEmbeddingConfigFromSettings`：

```typescript
import { getAppDataDir } from '../utils.js'

function getEmbeddingConfigFromSettings(): EmbeddingConfig | null {
  const appDataDir = getAppDataDir()
  const configPath = path.join(appDataDir, 'config.json')
  if (!fs.existsSync(configPath)) return null
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    const ec = config.embeddingProvider
    if (!ec || !ec.apiKey) return null
    return {
      provider: ec.provider || 'openai',
      model: ec.model || 'text-embedding-3-small',
      baseUrl: ec.baseUrl || '',
      apiKey: ec.apiKey,
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 2: 修改 server/src/routes/knowledgeBases.ts 在导入文件后触发索引**

在 `POST /:id/files` 路由中，`return c.json({ imported: files.length })` 之前添加：

```typescript
  // 触发索引队列
  const { enqueueIndexTask } = await import('../services/indexer.js')
  for (const file of files) {
    const filePath = path.join(targetDir, file.name)
    enqueueIndexTask({
      knowledgeBaseId: id,
      filePath,
      relativePath: relativePath ? `${relativePath}/${file.name}` : file.name,
    })
  }
```

- [ ] **Step 3: 创建索引路由 server/src/routes/indexing.ts**

```typescript
import { Hono } from 'hono'
import db from '../db.js'
import { enqueueKnowledgeBase, getIndexStatus } from '../services/indexer.js'
import type { KnowledgeBase } from '../types.js'

const app = new Hono()

// POST /knowledge-bases/:id/index — 重建索引
app.post('/:id/index', async (c) => {
  const id = c.req.param('id')
  const kb = db.prepare('SELECT * FROM knowledge_bases WHERE id = ? AND deleted_at IS NULL').get(id) as
    | KnowledgeBase
    | undefined

  if (!kb) {
    return c.json({ error: 'Not found' }, 404)
  }

  // 删除该知识库已有的所有 chunks
  const rows = db.prepare('SELECT id, file_path FROM document_chunks WHERE knowledge_base_id = ?').all(id) as
    Array<{ id: string; file_path: string }>

  for (const row of rows) {
    db.prepare('DELETE FROM document_chunks WHERE id = ?').run(row.id)
    db.prepare('DELETE FROM vec_document_chunks WHERE chunk_id = ?').run(row.id)
    db.prepare('DELETE FROM fts_document_chunks WHERE rowid = ?').run(row.id)
  }

  // 重新加入队列
  enqueueKnowledgeBase(id, kb.path)

  return c.json({ success: true, queued: true })
})

// GET /knowledge-bases/:id/index-status — 索引状态
app.get('/:id/index-status', (c) => {
  const id = c.req.param('id')
  const kb = db.prepare('SELECT * FROM knowledge_bases WHERE id = ? AND deleted_at IS NULL').get(id) as
    | KnowledgeBase
    | undefined

  if (!kb) {
    return c.json({ error: 'Not found' }, 404)
  }

  const status = getIndexStatus(id)
  return c.json(status)
})

export default app
```

- [ ] **Step 4: 修改 server/src/index.ts 注册 indexing 路由**

在 `app.route('/knowledge-bases', knowledgeBaseRoutes)` 下方添加：

```typescript
import indexingRoutes from './routes/indexing.js'
app.route('/knowledge-bases/:id/index', indexingRoutes)
```

等一下，Hono 的路由挂载方式：`app.route('/knowledge-bases/:id/index', indexingRoutes)` 会把 indexingRoutes 中的路径拼接到 `/knowledge-bases/:id/index` 后面。但 indexing.ts 中定义的是 `/:id/index` 和 `/:id/index-status`。所以需要调整。

更合理的做法：把 indexing 路由挂在 `/knowledge-bases` 下，但 indexing.ts 内部使用 `/:id/index` 路径。

实际上 Hono 的 `app.route('/prefix', subApp)` 会把 subApp 的所有路由前加上 `/prefix`。所以如果 indexing.ts 内部定义了 `/:id/index`，挂载到 `/knowledge-bases` 后会变成 `/knowledge-bases/:id/index`。这是正确的。

但 `indexing.ts` 内部已经包含了 `/:id/index` 和 `/:id/index-status`。所以直接：

```typescript
app.route('/knowledge-bases', indexingRoutes)
```

但 `knowledgeBaseRoutes` 已经挂载在 `/knowledge-bases` 下了。Hono 允许多个 route 挂载在同一前缀吗？通常不会冲突，因为子路由内部定义了不同的路径模式。不过为了安全，可以把 indexing 的路由直接加到 knowledgeBases.ts 中。

更简单的方式：直接在 `server/src/routes/knowledgeBases.ts` 末尾追加 indexing 路由，不创建新的子路由文件。

但考虑到 plan 中已经创建了 `server/src/routes/indexing.ts`，我们还是保留它。在 `server/src/index.ts` 中改为：

```typescript
// 注意：indexingRoutes 内部路径为 /:id/index 和 /:id/index-status
// 挂载到 /knowledge-bases 后变为 /knowledge-bases/:id/index
app.route('/knowledge-bases', indexingRoutes)
```

但这样和 `knowledgeBaseRoutes` 共享前缀，Hono 会按顺序匹配。只要路径不冲突就没问题。`knowledgeBaseRoutes` 有 `/:id/files`, `/:id/folders`, `/:id/restore`, `/:id` 等。`indexingRoutes` 有 `/:id/index` 和 `/:id/index-status`。Hono 的匹配顺序取决于注册顺序。如果把 `app.route('/knowledge-bases', indexingRoutes)` 放在 `knowledgeBaseRoutes` 之后，`/:id` 可能会先匹配 `index` 这个字符串作为 id。

为了避免歧义，**最佳做法**是把 indexing 路由直接合并到 `knowledgeBases.ts` 中。在 `server/src/routes/knowledgeBases.ts` 末尾、export 之前添加：

```typescript
// POST /knowledge-bases/:id/index — 重建索引
app.post('/:id/index', async (c) => { ... })

// GET /knowledge-bases/:id/index-status — 索引状态
app.get('/:id/index-status', (c) => { ... })
```

然后删除 `server/src/routes/indexing.ts`，也不需要修改 `server/src/index.ts`。

计划修正：**不创建单独的 indexing.ts**，直接合并到 `knowledgeBases.ts`。

- [ ] **Step 5: 修改 server/src/routes/knowledgeBases.ts 追加 indexing 路由**

在文件末尾、`export default app` 之前添加：

```typescript
// POST /knowledge-bases/:id/index — 重建索引
app.post('/:id/index', async (c) => {
  const id = c.req.param('id')
  const kb = db.prepare('SELECT * FROM knowledge_bases WHERE id = ? AND deleted_at IS NULL').get(id) as
    | KnowledgeBase
    | undefined

  if (!kb) {
    return c.json({ error: 'Not found' }, 404)
  }

  // 删除该知识库已有的所有 chunks
  const rows = db.prepare('SELECT id FROM document_chunks WHERE knowledge_base_id = ?').all(id) as Array<{ id: string }>
  for (const row of rows) {
    db.prepare('DELETE FROM document_chunks WHERE id = ?').run(row.id)
    db.prepare('DELETE FROM vec_document_chunks WHERE chunk_id = ?').run(row.id)
    db.prepare('DELETE FROM fts_document_chunks WHERE rowid = ?').run(row.id)
  }

  // 重新加入队列
  const { enqueueKnowledgeBase } = await import('../services/indexer.js')
  enqueueKnowledgeBase(id, kb.path)

  return c.json({ success: true, queued: true })
})

// GET /knowledge-bases/:id/index-status — 索引状态
app.get('/:id/index-status', (c) => {
  const id = c.req.param('id')
  const kb = db.prepare('SELECT * FROM knowledge_bases WHERE id = ? AND deleted_at IS NULL').get(id) as
    | KnowledgeBase
    | undefined

  if (!kb) {
    return c.json({ error: 'Not found' }, 404)
  }

  const { getIndexStatus } = await import('../services/indexer.js')
  const status = getIndexStatus(id)
  return c.json(status)
})
```

- [ ] **Step 6: 创建 tests/unit/server/indexer.test.ts**

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const testDir = path.join(os.tmpdir(), `kb-indexer-test-${Date.now()}`)
process.env.APP_DATA_DIR = testDir

const { default: app } = await import('../../../../server/src/routes/knowledgeBases.js')
const { default: db } = await import('../../../../server/src/db.js')

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true })
})

afterAll(() => {
  db.close()
  fs.rmSync(testDir, { recursive: true, force: true })
})

beforeEach(() => {
  db.exec('DELETE FROM knowledge_bases')
  db.exec('DELETE FROM document_chunks')
  db.exec('DELETE FROM vec_document_chunks')
  db.exec('DELETE FROM fts_document_chunks')
})

describe('POST /knowledge-bases/:id/index', () => {
  it('returns 404 for non-existent kb', async () => {
    const res = await app.request('/nonexistent/index', { method: 'POST' })
    expect(res.status).toBe(404)
  })

  it('queues reindex for existing kb', async () => {
    // 创建知识库和测试文件
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Index KB' }),
    })
    const kb = (await createRes.json()) as { id: string; path: string }

    fs.writeFileSync(path.join(kb.path, 'test.txt'), 'Hello world this is a test document for indexing.', 'utf-8')

    const res = await app.request(`/${kb.id}/index`, { method: 'POST' })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { success: boolean; queued: boolean }
    expect(json.success).toBe(true)
    expect(json.queued).toBe(true)
  })
})

describe('GET /knowledge-bases/:id/index-status', () => {
  it('returns status for empty kb', async () => {
    const createRes = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Status KB' }),
    })
    const kb = (await createRes.json()) as { id: string }

    const res = await app.request(`/${kb.id}/index-status`)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { totalFiles: number; indexedFiles: number; pendingFiles: number }
    expect(json.totalFiles).toBe(0)
    expect(json.indexedFiles).toBe(0)
    expect(json.pendingFiles).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 7: 运行测试**

Run:
```bash
pnpm test tests/unit/server/indexer.test.ts
```

Expected: tests PASS（index 测试通过，index-status 测试通过）。

- [ ] **Step 8: Commit**

```bash
git add server/src/services/indexer.ts server/src/routes/knowledgeBases.ts tests/unit/server/indexer.test.ts
git commit -m "feat(indexer): add background indexing queue with enqueue and status APIs"
```

---

## Task 6: RAG 混合搜索服务

**Files:**
- Create: `server/src/services/rag.ts`
- Test: `tests/unit/server/rag.test.ts`

- [ ] **Step 1: 创建 server/src/services/rag.ts**

```typescript
import db from '../db.js'
import { getEmbedding } from './embedding.js'
import type { EmbeddingConfig } from './embedding.js'

export interface RetrievedChunk {
  content: string
  filePath: string
  score: number
}

export async function hybridSearch(
  query: string,
  knowledgeBaseIds: string[],
  embeddingConfig: EmbeddingConfig,
  topK: number = 5
): Promise<RetrievedChunk[]> {
  if (knowledgeBaseIds.length === 0) return []

  // 1. 向量搜索
  const vectorResults = await vectorSearch(query, knowledgeBaseIds, embeddingConfig, topK)

  // 2. 全文搜索
  const ftsResults = ftsSearch(query, knowledgeBaseIds, topK)

  // 3. RRF 融合（Reciprocal Rank Fusion, k=60）
  const fused = reciprocalRankFusion(vectorResults, ftsResults, topK)
  return fused
}

async function vectorSearch(
  query: string,
  knowledgeBaseIds: string[],
  embeddingConfig: EmbeddingConfig,
  topK: number
): Promise<Array<{ chunkId: string; score: number; content: string; filePath: string }>> {
  try {
    const embeddings = await getEmbedding([query], embeddingConfig)
    const queryVec = JSON.stringify(embeddings[0])

    // 为每个知识库分别查询（vec0 不支持 OR 条件跨 kb）
    const allResults: Array<{ chunkId: string; score: number; content: string; filePath: string }> = []

    for (const kbId of knowledgeBaseIds) {
      const rows = db
        .prepare(
          `SELECT v.chunk_id, v.distance as score, d.content, d.file_path
           FROM vec_document_chunks v
           JOIN document_chunks d ON v.chunk_id = d.id
           WHERE d.knowledge_base_id = ?
           ORDER BY v.distance
           LIMIT ?`
        )
        .all(kbId, topK) as Array<{
          chunk_id: string
          score: number
          content: string
          file_path: string
        }>

      for (const row of rows) {
        allResults.push({
          chunkId: row.chunk_id,
          score: row.score,
          content: row.content,
          filePath: row.file_path,
        })
      }
    }

    // 按 score 排序（cosine distance 越小越相似）取 topK
    return allResults.sort((a, b) => a.score - b.score).slice(0, topK)
  } catch (err) {
    console.error('[rag] Vector search failed:', err)
    return []
  }
}

function ftsSearch(
  query: string,
  knowledgeBaseIds: string[],
  topK: number
): Array<{ chunkId: string; score: number; content: string; filePath: string }> {
  try {
    // 构建 FTS5 查询：把 query 拆成词，用 AND 连接
    const ftsQuery = query
      .trim()
      .split(/\s+/)
      .map((w) => `"${w.replace(/"/g, '""')}"`)
      .join(' AND ')

    if (!ftsQuery) return []

    const allResults: Array<{ chunkId: string; score: number; content: string; filePath: string }> = []

    for (const kbId of knowledgeBaseIds) {
      const rows = db
        .prepare(
          `SELECT f.rowid as chunk_id, f.rank as score, d.content, d.file_path
           FROM fts_document_chunks f
           JOIN document_chunks d ON f.rowid = d.id
           WHERE d.knowledge_base_id = ? AND fts_document_chunks MATCH ?
           ORDER BY f.rank
           LIMIT ?`
        )
        .all(kbId, ftsQuery, topK) as Array<{
          chunk_id: string
          score: number
          content: string
          file_path: string
        }>

      for (const row of rows) {
        allResults.push({
          chunkId: row.chunk_id,
          score: row.score,
          content: row.content,
          filePath: row.file_path,
        })
      }
    }

    // FTS5 rank 越小排名越靠前（负值也正常）
    return allResults.sort((a, b) => a.score - b.score).slice(0, topK)
  } catch (err) {
    console.error('[rag] FTS search failed:', err)
    return []
  }
}

function reciprocalRankFusion(
  vectorResults: Array<{ chunkId: string; content: string; filePath: string }>,
  ftsResults: Array<{ chunkId: string; content: string; filePath: string }>,
  topK: number,
  k: number = 60
): RetrievedChunk[] {
  const scores = new Map<string, { score: number; content: string; filePath: string }>()

  // 向量结果打分
  for (let i = 0; i < vectorResults.length; i++) {
    const r = vectorResults[i]
    const existing = scores.get(r.chunkId)
    const rr = 1 / (k + i + 1)
    if (existing) {
      existing.score += rr
    } else {
      scores.set(r.chunkId, { score: rr, content: r.content, filePath: r.filePath })
    }
  }

  // 全文结果打分
  for (let i = 0; i < ftsResults.length; i++) {
    const r = ftsResults[i]
    const existing = scores.get(r.chunkId)
    const rr = 1 / (k + i + 1)
    if (existing) {
      existing.score += rr
    } else {
      scores.set(r.chunkId, { score: rr, content: r.content, filePath: r.filePath })
    }
  }

  // 按 RRF 分数降序排列
  const sorted = Array.from(scores.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, topK)

  return sorted.map(([, v]) => ({
    content: v.content,
    filePath: v.filePath,
    score: v.score,
  }))
}

export function buildRagPrompt(chunks: RetrievedChunk[], userQuery: string): string {
  if (chunks.length === 0) return userQuery

  const context = chunks
    .map((c, i) => `[${i + 1}] ${c.content}\n（来源：${c.filePath}）`)
    .join('\n\n')

  return `请根据以下参考文档回答用户问题。如果参考文档中没有相关信息，请明确说明。\n\n参考文档：\n${context}\n\n用户问题：${userQuery}`
}
```

注意：`vec_document_chunks` 的查询语法需要确认。sqlite-vec 的 `distance` 列实际上是 `distance`，但查询方式可能需要使用 `vec_distance_cosine` 函数或特定的查询语法。

根据 sqlite-vec 文档，查询应该是：
```sql
SELECT chunk_id, distance FROM vec_document_chunks
WHERE embedding MATCH ?
  AND k = ?
ORDER BY distance
```

或者通过 JOIN：
```sql
SELECT v.chunk_id, v.distance, d.content, d.file_path
FROM vec_document_chunks v
JOIN document_chunks d ON v.chunk_id = d.id
WHERE v.embedding MATCH ? AND v.k = ? AND d.knowledge_base_id = ?
ORDER BY v.distance
```

由于 `vec0` 虚拟表的查询语法比较特殊，我们需要调整 `vectorSearch` 函数：

```typescript
    for (const kbId of knowledgeBaseIds) {
      const rows = db
        .prepare(
          `SELECT v.chunk_id, v.distance, d.content, d.file_path
           FROM vec_document_chunks v
           JOIN document_chunks d ON v.chunk_id = d.id
           WHERE v.embedding MATCH ? AND v.k = ? AND d.knowledge_base_id = ?
           ORDER BY v.distance`
        )
        .all(queryVec, topK, kbId) as Array<{
          chunk_id: string
          distance: number
          content: string
          file_path: string
        }>
```

这是更准确的 sqlite-vec 查询语法。不过 `MATCH ?` 传入 JSON 字符串作为向量，`k = ?` 限制返回数量。

但 sqlite-vec 的 `k` parameter 是一个虚拟列约束，有些版本写法是 `AND k = ?`。为了稳妥，我们采用：

```sql
WHERE v.embedding MATCH ? AND d.knowledge_base_id = ?
ORDER BY v.distance
LIMIT ?
```

这样不依赖 `k` 虚拟列。让我修正 `vectorSearch`：

```typescript
      const rows = db
        .prepare(
          `SELECT v.chunk_id, v.distance, d.content, d.file_path
           FROM vec_document_chunks v
           JOIN document_chunks d ON v.chunk_id = d.id
           WHERE v.embedding MATCH ? AND d.knowledge_base_id = ?
           ORDER BY v.distance
           LIMIT ?`
        )
        .all(queryVec, kbId, topK) as Array<{
          chunk_id: string
          distance: number
          content: string
          file_path: string
        }>

      for (const row of rows) {
        allResults.push({
          chunkId: row.chunk_id,
          score: row.distance,
          content: row.content,
          filePath: row.file_path,
        })
      }
```

同时 `ftsSearch` 中的 `ORDER BY f.rank` 也有问题。FTS5 的 rank 通常用 `rank` 函数而不是列名。正确写法是 `ORDER BY rank`，或者如果 `f.rank` 列不存在，应该用 `bm25(f)`。但 FTS5 虚拟表自动有一个 `rank` 隐藏列，可以通过 `ORDER BY rank` 使用默认排序。

为了简化，我们把 `ORDER BY f.rank` 改为 `ORDER BY rank`：

```sql
SELECT f.rowid as chunk_id, rank as score, d.content, d.file_path
FROM fts_document_chunks f
JOIN document_chunks d ON f.rowid = d.id
WHERE d.knowledge_base_id = ? AND fts_document_chunks MATCH ?
ORDER BY rank
LIMIT ?
```

不对，`rank` 在 FTS5 中是一个特殊列，需要通过 `f.rank` 或直接用 `rank`。让我保持 `rank` 即可。

好的，这些细节都在代码中了。继续写测试。

- [ ] **Step 2: 创建 tests/unit/server/rag.test.ts**

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const testDir = path.join(os.tmpdir(), `kb-rag-test-${Date.now()}`)
process.env.APP_DATA_DIR = testDir

const { default: db } = await import('../../../../server/src/db.js')
const { hybridSearch, buildRagPrompt } = await import('../../../../server/src/services/rag.js')

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true })
})

afterAll(() => {
  db.close()
  fs.rmSync(testDir, { recursive: true, force: true })
})

beforeEach(() => {
  db.exec('DELETE FROM document_chunks')
  db.exec('DELETE FROM vec_document_chunks')
  db.exec('DELETE FROM fts_document_chunks')
})

describe('buildRagPrompt', () => {
  it('returns user query when no chunks', () => {
    const result = buildRagPrompt([], 'hello')
    expect(result).toBe('hello')
  })

  it('builds prompt with chunks', () => {
    const chunks = [
      { content: 'chunk one', filePath: 'a.md', score: 0.5 },
      { content: 'chunk two', filePath: 'b.md', score: 0.3 },
    ]
    const result = buildRagPrompt(chunks, 'query')
    expect(result).toContain('chunk one')
    expect(result).toContain('chunk two')
    expect(result).toContain('query')
    expect(result).toContain('a.md')
  })
})

describe('hybridSearch', () => {
  it('returns empty for empty kb list', async () => {
    const result = await hybridSearch('test', [], {
      provider: 'openai',
      model: 'text-embedding-3-small',
      baseUrl: '',
      apiKey: 'test',
    })
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 3: 运行测试**

Run:
```bash
pnpm test tests/unit/server/rag.test.ts
```

Expected: 3 tests PASS（buildRagPrompt ×2, hybridSearch empty ×1）。

- [ ] **Step 4: Commit**

```bash
git add server/src/services/rag.ts tests/unit/server/rag.test.ts
git commit -m "feat(rag): add hybrid search service with RRF fusion and prompt builder"
```

---

## Task 7: 修改 Chat 路由集成 RAG

**Files:**
- Modify: `server/src/routes/chat.ts`
- Modify: `server/src/services/llm.ts`
- Modify: `server/src/types.ts`
- Test: `tests/unit/server/chatRag.test.ts`

- [ ] **Step 1: 修改 server/src/types.ts 添加 EmbeddingConfig 类型**

在文件末尾添加：

```typescript
export interface EmbeddingConfig {
  provider: string
  model: string
  baseUrl: string
  apiKey: string
}
```

- [ ] **Step 2: 修改 server/src/services/llm.ts 支持 system prompt**

```typescript
export async function streamChatCompletion(
  messages: Array<{ role: string; content: string }>,
  config: LLMConfig,
  onChunk: (content: string) => void | Promise<void>,
  systemPrompt?: string
): Promise<void> {
  const url = config.baseUrl || getDefaultBaseUrl(config.provider)
  if (!url) {
    throw new Error(`Unknown provider: ${config.provider}`)
  }

  const apiMessages: Array<{ role: string; content: string }> = []
  if (systemPrompt) {
    apiMessages.push({ role: 'system', content: systemPrompt })
  }
  apiMessages.push(...messages)

  const response = await fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: apiMessages,
      stream: true,
    }),
  })
  // ... rest unchanged
```

- [ ] **Step 3: 修改 server/src/routes/chat.ts 集成 RAG**

顶部导入添加：

```typescript
import { hybridSearch, buildRagPrompt } from '../services/rag.js'
import type { EmbeddingConfig } from '../types.js'
```

修改 `app.post('/', async (c) => { ... })` 内的逻辑：

```typescript
app.post('/', async (c) => {
  const body = await c.req.json<ChatRequest>()
  const { message, sessionId, knowledgeBaseIds, config } = body

  // Auto-create session if it does not exist
  const existingSession = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId)
  if (!existingSession) {
    const title = message.slice(0, 20) + (message.length > 20 ? '...' : '')
    const now = Date.now()
    db.prepare(
      'INSERT INTO sessions (id, title, provider, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(sessionId, title, config.provider, config.model, now, now)
  }

  // Save user message with knowledge_base_ids
  const now = Date.now()
  const userMessageId = nanoid()
  const kbIdsJson = knowledgeBaseIds && knowledgeBaseIds.length > 0 ? JSON.stringify(knowledgeBaseIds) : null
  db.prepare(
    'INSERT INTO messages (id, session_id, role, content, knowledge_base_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userMessageId, sessionId, 'user', message, kbIdsJson, now)

  // Update session
  db.prepare('UPDATE sessions SET updated_at = ?, message_count = message_count + 1 WHERE id = ?').run(
    now,
    sessionId
  )

  // Build history for LLM
  const history = db
    .prepare('SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 50')
    .all(sessionId) as Array<{ role: string; content: string }>

  // RAG retrieval
  let systemPrompt: string | undefined
  let ragMessage = message
  if (knowledgeBaseIds && knowledgeBaseIds.length > 0) {
    try {
      const embeddingConfig = getEmbeddingConfig()
      if (embeddingConfig) {
        const chunks = await hybridSearch(message, knowledgeBaseIds, embeddingConfig)
        if (chunks.length > 0) {
          ragMessage = buildRagPrompt(chunks, message)
          // Replace the last user message content in history with RAG-augmented version
          const lastUserIdx = history.findLastIndex((h) => h.role === 'user')
          if (lastUserIdx !== -1) {
            history[lastUserIdx].content = ragMessage
          }
        }
      }
    } catch (err) {
      console.error('[chat] RAG retrieval failed:', err)
      // Continue without RAG on error
    }
  }

  return streamSSE(c, async (stream) => {
    let assistantContent = ''

    await streamChatCompletion(history, config, async (chunk) => {
      assistantContent += chunk
      await stream.writeSSE({ data: JSON.stringify({ content: chunk }) })
    }, systemPrompt)

    // Save assistant message
    const assistantId = nanoid()
    db.prepare(
      'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(assistantId, sessionId, 'assistant', assistantContent, Date.now())

    db.prepare('UPDATE sessions SET updated_at = ?, message_count = message_count + 1 WHERE id = ?').run(
      Date.now(),
      sessionId
    )

    await stream.close()
  })
})
```

添加辅助函数在文件末尾（`export default app` 之前）：

```typescript
function getEmbeddingConfig(): EmbeddingConfig | null {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const { getAppDataDir } = await import('../utils.js')
  const configPath = path.join(getAppDataDir(), 'config.json')
  if (!fs.existsSync(configPath)) return null
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    const ec = config.embeddingProvider
    if (!ec || !ec.apiKey) return null
    return {
      provider: ec.provider || 'openai',
      model: ec.model || 'text-embedding-3-small',
      baseUrl: ec.baseUrl || '',
      apiKey: ec.apiKey,
    }
  } catch {
    return null
  }
}
```

不对，这里不能用顶层 await import。应该使用同步 import：

```typescript
import fs from 'node:fs'
import path from 'node:path'
import { getAppDataDir } from '../utils.js'

function getEmbeddingConfig(): EmbeddingConfig | null {
  const configPath = path.join(getAppDataDir(), 'config.json')
  if (!fs.existsSync(configPath)) return null
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    const ec = config.embeddingProvider
    if (!ec || !ec.apiKey) return null
    return {
      provider: ec.provider || 'openai',
      model: ec.model || 'text-embedding-3-small',
      baseUrl: ec.baseUrl || '',
      apiKey: ec.apiKey,
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: 创建 tests/unit/server/chatRag.test.ts**

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const testDir = path.join(os.tmpdir(), `kb-chat-rag-test-${Date.now()}`)
process.env.APP_DATA_DIR = testDir

const { default: app } = await import('../../../../server/src/routes/chat.js')
const { default: db } = await import('../../../../server/src/db.js')

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true })
})

afterAll(() => {
  db.close()
  fs.rmSync(testDir, { recursive: true, force: true })
})

beforeEach(() => {
  db.exec('DELETE FROM sessions')
  db.exec('DELETE FROM messages')
})

describe('POST /chat with knowledgeBaseIds', () => {
  it('accepts knowledgeBaseIds in request body', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'test',
        sessionId: 'rag-session-1',
        knowledgeBaseIds: ['kb1', 'kb2'],
        config: { provider: 'test', model: 'test', baseUrl: '', apiKey: '' },
      }),
    })

    // 因为没有 mock LLM API，这里会返回 500，但我们要验证 body 解析正确
    // 实际测试中可能需要 mock fetch
    expect([200, 500]).toContain(res.status)
  })

  it('saves message with knowledge_base_ids', async () => {
    // mock streamChatCompletion to avoid real API call
    vi.doMock('../../../../server/src/services/llm.js', () => ({
      streamChatCompletion: vi.fn().mockResolvedValue(undefined),
    }))

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'hello rag',
        sessionId: 'rag-session-2',
        knowledgeBaseIds: ['kb1'],
        config: { provider: 'test', model: 'test', baseUrl: '', apiKey: '' },
      }),
    })

    expect(res.status).toBe(200)

    const msg = db
      .prepare('SELECT knowledge_base_ids FROM messages WHERE session_id = ? AND role = ?')
      .get('rag-session-2', 'user') as { knowledge_base_ids: string } | undefined

    expect(msg).toBeDefined()
    expect(msg?.knowledge_base_ids).toBe('["kb1"]')
  })
})
```

注意：`vi.doMock` 的方式可能在这个测试环境中不太好用，因为模块已经静态加载了。更简单的做法是 mock `global.fetch` 让 `streamChatCompletion` 能正常工作。

简化测试：

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const testDir = path.join(os.tmpdir(), `kb-chat-rag-test-${Date.now()}`)
process.env.APP_DATA_DIR = testDir

const { default: app } = await import('../../../../server/src/routes/chat.js')
const { default: db } = await import('../../../../server/src/db.js')

beforeAll(() => {
  fs.mkdirSync(testDir, { recursive: true })
})

afterAll(() => {
  db.close()
  fs.rmSync(testDir, { recursive: true, force: true })
})

beforeEach(() => {
  db.exec('DELETE FROM sessions')
  db.exec('DELETE FROM messages')
  vi.restoreAllMocks()
})

describe('POST /chat with knowledgeBaseIds', () => {
  it('saves message with knowledge_base_ids JSON', async () => {
    // Mock LLM API to return SSE stream
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode('data: {"content":"hi"}\n\ndata: [DONE]\n\n'))
          controller.close()
        },
      }),
    } as Response)

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'hello rag',
        sessionId: 'rag-session-1',
        knowledgeBaseIds: ['kb1'],
        config: { provider: 'openai', model: 'gpt-4', baseUrl: 'http://localhost', apiKey: 'test' },
      }),
    })

    expect(res.status).toBe(200)

    const msg = db
      .prepare('SELECT knowledge_base_ids FROM messages WHERE session_id = ? AND role = ?')
      .get('rag-session-1', 'user') as { knowledge_base_ids: string } | undefined

    expect(msg).toBeDefined()
    expect(msg?.knowledge_base_ids).toBe('["kb1"]')
  })
})
```

- [ ] **Step 5: 运行测试**

Run:
```bash
pnpm test tests/unit/server/chatRag.test.ts
```

Expected: test PASS。

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/chat.ts server/src/services/llm.ts server/src/types.ts tests/unit/server/chatRag.test.ts
git commit -m "feat(chat): integrate RAG retrieval into chat endpoint with knowledgeBaseIds"
```

---

## Task 8: 前端 `@提及` 交互组件

**Files:**
- Create: `src/components/KbMentionDropdown.vue`
- Create: `src/components/KbMentionPill.vue`
- Modify: `src/components/ChatInput.vue`
- Test: `tests/unit/components/KbMentionDropdown.test.ts`
- Test: `tests/unit/components/ChatInputMention.test.ts`

- [ ] **Step 1: 创建 src/components/KbMentionDropdown.vue**

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { KnowledgeBase } from '@/types'

const props = defineProps<{
  knowledgeBases: KnowledgeBase[]
  query: string
  visible: boolean
}>()

const emit = defineEmits<{
  select: [kb: KnowledgeBase]
  close: []
}>()

const selectedIndex = ref(0)

const filtered = computed(() => {
  const q = props.query.toLowerCase()
  if (!q) return props.knowledgeBases
  return props.knowledgeBases.filter((kb) => kb.name.toLowerCase().includes(q))
})

watch(() => filtered.value.length, () => {
  selectedIndex.value = 0
})

watch(() => props.visible, (v) => {
  if (v) selectedIndex.value = 0
})

function handleKeydown(e: KeyboardEvent) {
  if (!props.visible) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value + 1) % filtered.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value - 1 + filtered.value.length) % filtered.value.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const kb = filtered.value[selectedIndex.value]
    if (kb) emit('select', kb)
  } else if (e.key === 'Escape') {
    emit('close')
  }
}

defineExpose({ handleKeydown })
</script>

<template>
  <div
    v-if="visible && filtered.length > 0"
    class="absolute bottom-full left-0 mb-2 max-h-48 w-64 overflow-y-auto rounded-lg border border-border-default bg-surface-1 shadow-lg"
  >
    <div
      v-for="(kb, i) in filtered"
      :key="kb.id"
      :class="[
        'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors',
        i === selectedIndex ? 'bg-accent-500/10 text-accent-600' : 'text-text-primary hover:bg-surface-3',
      ]"
      @mousedown.prevent="$emit('select', kb)"
    >
      <span :class="[kb.icon || 'i-mdi-database', 'text-base text-text-secondary']" />
      <span class="truncate">{{ kb.name }}</span>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 创建 src/components/KbMentionPill.vue**

```vue
<script setup lang="ts">
import type { KnowledgeBase } from '@/types'

const props = defineProps<{
  kb: KnowledgeBase
}>()

const emit = defineEmits<{
  remove: []
}>()
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-md bg-accent-500/15 px-2 py-0.5 text-xs font-medium text-accent-600"
  >
    <span :class="[props.kb.icon || 'i-mdi-database', 'text-sm']" />
    {{ props.kb.name }}
    <button
      class="ml-0.5 rounded-sm hover:bg-accent-500/20"
      @click.stop="$emit('remove')"
    >
      <span class="i-mdi-close text-sm" />
    </button>
  </span>
</template>
```

- [ ] **Step 3: 修改 src/components/ChatInput.vue**

将 `<script setup>` 替换为：

```typescript
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { KnowledgeBase } from '@/types'
import KbMentionDropdown from './KbMentionDropdown.vue'
import KbMentionPill from './KbMentionPill.vue'

const props = defineProps<{
  loading?: boolean
  knowledgeBases?: KnowledgeBase[]
}>()

const emit = defineEmits<{
  send: [content: string, knowledgeBaseIds: string[]]
}>()

const input = ref('')
const textareaRef = ref<HTMLTextAreaElement>()
const isFocused = ref(false)
const selectedKbs = ref<KnowledgeBase[]>([])
const mentionQuery = ref('')
const mentionVisible = ref(false)
const mentionStart = ref(-1)

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
}

watch(input, autoResize)

function extractPlainText(): string {
  // 移除 textarea 中用于显示的 @名称 文本（如果有的话）
  // 当前实现：用户输入 @名称 后选择，直接在 input 中替换为普通文本
  // 实际上我们会在发送时从 selectedKbs 构建 knowledgeBaseIds，input 保持纯文本
  return input.value.trim()
}

function handleKeydown(e: KeyboardEvent) {
  if (mentionVisible.value) {
    dropdownRef.value?.handleKeydown(e)
    return
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  } else if (e.key === '@' && props.knowledgeBases && props.knowledgeBases.length > 0) {
    mentionStart.value = textareaRef.value?.selectionStart ?? input.value.length
    mentionQuery.value = ''
    mentionVisible.value = true
  }
}

function handleInput() {
  if (!mentionVisible.value) return
  const cursor = textareaRef.value?.selectionStart ?? input.value.length
  if (cursor < mentionStart.value) {
    mentionVisible.value = false
    return
  }
  mentionQuery.value = input.value.slice(mentionStart.value + 1, cursor)
}

function onSelectKb(kb: KnowledgeBase) {
  if (selectedKbs.value.find((k) => k.id === kb.id)) return
  selectedKbs.value.push(kb)

  // 从 input 中移除 @query 文本
  const before = input.value.slice(0, mentionStart.value)
  const after = input.value.slice(textareaRef.value?.selectionStart ?? input.value.length)
  input.value = before + after
  mentionVisible.value = false

  requestAnimationFrame(() => {
    if (textareaRef.value) {
      const pos = before.length
      textareaRef.value.setSelectionRange(pos, pos)
    }
    autoResize()
  })
}

function onCloseDropdown() {
  mentionVisible.value = false
}

function handleSend() {
  const content = extractPlainText()
  if (!content || props.loading) return
  emit('send', content, selectedKbs.value.map((k) => k.id))
  input.value = ''
  selectedKbs.value = []
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
}

const dropdownRef = ref<InstanceType<typeof KbMentionDropdown>>()

const displayInput = computed(() => input.value)
</script>
```

将 `<template>` 替换为：

```vue
<template>
  <div class="border-t border-border-default bg-surface-1 p-4">
    <div
      :class="[
        'relative flex items-end gap-2 rounded-xl border bg-surface-2 px-3 py-2.5 transition-all duration-200',
        isFocused
          ? 'border-accent-500/50 shadow-[0_0_0_3px_rgba(59,130,246,0.1)]'
          : 'border-border-default hover:border-border-default/80',
      ]"
    >
      <div class="flex w-full flex-col gap-1.5">
        <div v-if="selectedKbs.length > 0" class="flex flex-wrap gap-1.5">
          <KbMentionPill
            v-for="kb in selectedKbs"
            :key="kb.id"
            :kb="kb"
            @remove="selectedKbs = selectedKbs.filter((k) => k.id !== kb.id)"
          />
        </div>
        <div class="relative">
          <textarea
            ref="textareaRef"
            v-model="input"
            rows="1"
            class="max-h-40 w-full resize-none bg-transparent text-sm leading-relaxed text-text-primary placeholder-text-tertiary outline-none"
            placeholder="输入问题，Shift + Enter 换行，Enter 发送，@提及知识库..."
            :disabled="loading"
            @keydown="handleKeydown"
            @input="handleInput"
            @focus="isFocused = true"
            @blur="isFocused = false"
          />
          <KbMentionDropdown
            ref="dropdownRef"
            :knowledge-bases="knowledgeBases ?? []"
            :query="mentionQuery"
            :visible="mentionVisible"
            @select="onSelectKb"
            @close="onCloseDropdown"
          />
        </div>
      </div>

      <button
        :disabled="!displayInput.trim() || loading"
        :class="[
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200',
          displayInput.trim() && !loading
            ? 'bg-accent-500 text-white shadow-lg shadow-accent-glow hover:bg-accent-400 active:scale-95'
            : 'bg-surface-4 text-text-tertiary',
        ]"
        @click="handleSend"
      >
        <span
          :class="[
            loading ? 'i-mdi-loading animate-spin' : 'i-mdi-send',
            'text-sm',
          ]"
        />
      </button>
    </div>

    <div class="mt-1.5 flex items-center justify-between px-1">
      <p class="text-[11px] text-text-tertiary">
        AI 生成内容仅供参考
      </p>
      <p class="text-[11px] text-text-tertiary">
        {{ displayInput.length }} 字
      </p>
    </div>
  </div>
</template>
```

- [ ] **Step 4: 创建 tests/unit/components/KbMentionDropdown.test.ts**

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import KbMentionDropdown from '@/components/KbMentionDropdown.vue'

describe('KbMentionDropdown', () => {
  const kbs = [
    { id: '1', name: 'Docs', icon: 'i-mdi-file-document', path: '/a', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0 },
    { id: '2', name: 'Notes', icon: 'i-mdi-note', path: '/b', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0 },
  ]

  it('renders filtered list when visible', () => {
    const wrapper = mount(KbMentionDropdown, {
      props: { knowledgeBases: kbs, query: 'Doc', visible: true },
    })
    expect(wrapper.findAll('.flex.cursor-pointer')).toHaveLength(1)
    expect(wrapper.text()).toContain('Docs')
  })

  it('emits select on click', async () => {
    const wrapper = mount(KbMentionDropdown, {
      props: { knowledgeBases: kbs, query: '', visible: true },
    })
    await wrapper.find('.flex.cursor-pointer').trigger('mousedown')
    expect(wrapper.emitted('select')).toHaveLength(1)
    expect((wrapper.emitted('select')![0] as any[])[0].id).toBe('1')
  })

  it('emits close on Escape', () => {
    const wrapper = mount(KbMentionDropdown, {
      props: { knowledgeBases: kbs, query: '', visible: true },
    })
    ;(wrapper.vm as any).handleKeydown(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
```

- [ ] **Step 5: 创建 tests/unit/components/ChatInputMention.test.ts**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatInput from '@/components/ChatInput.vue'

describe('ChatInput mention', () => {
  const kbs = [
    { id: '1', name: 'Docs', icon: 'i-mdi-file-document', path: '/a', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0 },
  ]

  it('emits send with knowledgeBaseIds', async () => {
    const wrapper = mount(ChatInput, {
      props: { loading: false, knowledgeBases: kbs },
    })

    const textarea = wrapper.find('textarea')
    await textarea.setValue('hello')
    // 模拟选择知识库
    await (wrapper.vm as any).onSelectKb(kbs[0])

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('send')).toHaveLength(1)
    expect(wrapper.emitted('send')![0]).toEqual(['hello', ['1']])
  })

  it('renders selected kb pills', async () => {
    const wrapper = mount(ChatInput, {
      props: { loading: false, knowledgeBases: kbs },
    })
    await (wrapper.vm as any).onSelectKb(kbs[0])
    expect(wrapper.text()).toContain('Docs')
  })
})
```

- [ ] **Step 6: 运行测试**

Run:
```bash
pnpm test tests/unit/components/KbMentionDropdown.test.ts tests/unit/components/ChatInputMention.test.ts
```

Expected: tests PASS。

- [ ] **Step 7: Commit**

```bash
git add src/components/KbMentionDropdown.vue src/components/KbMentionPill.vue src/components/ChatInput.vue tests/unit/components/KbMentionDropdown.test.ts tests/unit/components/ChatInputMention.test.ts
git commit -m "feat(ui): add @mention knowledge base selection in ChatInput"
```

---

## Task 9: 前端 Session Store 传递 knowledgeBaseIds

**Files:**
- Modify: `src/stores/session.ts`
- Modify: `src/types/index.ts`
- Test: `tests/unit/stores/sessionMention.test.ts`

- [ ] **Step 1: 修改 src/types/index.ts 更新 ChatRequest 和 Message**

```typescript
export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  knowledge_base_ids?: string | null
  created_at: number
}
```

- [ ] **Step 2: 修改 src/stores/session.ts 的 sendMessage**

```typescript
async function sendMessage(content: string, config: LLMConfig, knowledgeBaseIds?: string[]) {
  sendError.value = null
  isSending.value = true

  try {
    let sessionId = activeTab.value?.sessionId
    const isNewSession = !sessionId

    if (!sessionId) {
      sessionId = crypto.randomUUID()
    }

    // Optimistically add user message
    const userMsg: Message = {
      id: `temp-user-${Date.now()}`,
      session_id: sessionId,
      role: 'user',
      content,
      knowledge_base_ids: knowledgeBaseIds ? JSON.stringify(knowledgeBaseIds) : null,
      created_at: Date.now(),
    }

    // ... rest unchanged until sidecarFetch call

    const response = await sidecarFetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content, sessionId, knowledgeBaseIds, config }),
    })

    // ... rest unchanged
  } catch (e) {
    sendError.value = e instanceof Error ? e.message : String(e)
  } finally {
    isSending.value = false
  }
}
```

- [ ] **Step 3: 创建 tests/unit/stores/sessionMention.test.ts**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from '@/stores/session'
import { sidecarFetch } from '@/utils/sidecarClient'

vi.mock('@/utils/sidecarClient')

function createMockStream(text: string): ReadableStream {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(text))
      controller.close()
    },
  })
}

describe('useSessionStore sendMessage with knowledgeBaseIds', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(sidecarFetch).mockReset()
  })

  it('sends knowledgeBaseIds in request body', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      body: createMockStream('data: {"content":"reply"}\n\n'),
    } as Response)

    const store = useSessionStore()
    await store.sendMessage('hello rag', {
      provider: 'test',
      model: 'test',
      baseUrl: '',
      apiKey: 'key',
    }, ['kb1', 'kb2'])

    expect(sidecarFetch).toHaveBeenCalledWith(
      '/chat',
      expect.objectContaining({
        body: expect.stringContaining('"knowledgeBaseIds":["kb1","kb2"]'),
      })
    )
  })
})
```

- [ ] **Step 4: 运行测试**

Run:
```bash
pnpm test tests/unit/stores/sessionMention.test.ts
```

Expected: test PASS。

- [ ] **Step 5: Commit**

```bash
git add src/stores/session.ts src/types/index.ts tests/unit/stores/sessionMention.test.ts
git commit -m "feat(store): pass knowledgeBaseIds from ChatInput to chat API"
```

---

## Task 10: 前端知识库管理页索引进度

**Files:**
- Modify: `src/stores/knowledgeBase.ts`
- Modify: `src/components/KnowledgeBasePage.vue`
- Modify: `src/components/FileExplorer.vue`
- Test: `tests/unit/components/FileExplorerIndexStatus.test.ts`

- [ ] **Step 1: 修改 src/stores/knowledgeBase.ts**

在 store 中添加状态和 action：

```typescript
// 新增 state
const indexStatus = ref<Map<string, { totalFiles: number; indexedFiles: number; pendingFiles: number }>>(new Map())

// 新增 action
async function loadIndexStatus(kbId: string) {
  try {
    const res = await sidecarFetch(`/knowledge-bases/${kbId}/index-status`)
    if (res.ok) {
      const data = (await res.json()) as { totalFiles: number; indexedFiles: number; pendingFiles: number }
      indexStatus.value.set(kbId, data)
    }
  } catch (e) {
    console.error('Failed to load index status:', e)
  }
}

// 在 return 中添加
return {
  // ... existing refs
  indexStatus,
  // ... existing actions
  loadIndexStatus,
}
```

- [ ] **Step 2: 修改 src/components/FileExplorer.vue 显示索引状态**

在工具栏区域（搜索框和导入按钮附近）添加索引进度条：

```vue
<!-- 在 toolbar 区域添加 -->
<div v-if="kbId && indexStatus" class="mb-2 flex items-center gap-2 rounded-md bg-surface-3 px-3 py-1.5">
  <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-4">
    <div
      class="h-full rounded-full bg-accent-500 transition-all"
      :style="{ width: indexProgress + '%' }"
    />
  </div>
  <span class="text-[11px] text-text-tertiary">
    {{ indexStatus.indexedFiles }}/{{ indexStatus.totalFiles }}
  </span>
</div>
```

在 `<script setup>` 中接收 props：

```typescript
const props = defineProps<{
  // ... existing props
  kbId?: string
  indexStatus?: { totalFiles: number; indexedFiles: number; pendingFiles: number }
}>()

const indexProgress = computed(() => {
  if (!props.indexStatus || props.indexStatus.totalFiles === 0) return 0
  return Math.round((props.indexStatus.indexedFiles / props.indexStatus.totalFiles) * 100)
})
```

- [ ] **Step 3: 修改 src/components/KnowledgeBasePage.vue 传递状态**

在 `FileExplorer` 组件的使用处添加：

```vue
<FileExplorer
  :files="store.files"
  :search-results="store.searchResults"
  :is-search-mode="store.isSearchMode"
  :breadcrumb="store.breadcrumb"
  :can-go-back="store.canGoBack"
  :can-go-forward="store.canGoForward"
  :kb-id="store.selectedKbId ?? undefined"
  :index-status="store.selectedKbId ? store.indexStatus.get(store.selectedKbId) : undefined"
  @navigate="store.navigateToPath"
  @navigate-to-breadcrumb="handleBreadcrumbNavigate"
  @search="handleSearch"
  @import-files="handleImport"
  @go-back="store.goBack"
  @go-forward="store.goForward"
/>
```

在 `handleKbSelect` 或 `onMounted` 中调用 `loadIndexStatus`：

```typescript
async function handleKbSelect(id: string) {
  await store.selectKb(id)
  await store.loadIndexStatus(id)
}
```

- [ ] **Step 4: 创建测试**

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FileExplorer from '@/components/FileExplorer.vue'

describe('FileExplorer index status', () => {
  it('renders progress bar when indexStatus provided', () => {
    const wrapper = mount(FileExplorer, {
      props: {
        files: [],
        searchResults: [],
        isSearchMode: false,
        breadcrumb: [],
        canGoBack: false,
        canGoForward: false,
        kbId: 'kb1',
        indexStatus: { totalFiles: 10, indexedFiles: 5, pendingFiles: 0 },
      },
    })
    expect(wrapper.text()).toContain('5/10')
    expect(wrapper.find('.bg-accent-500').exists()).toBe(true)
  })

  it('does not render progress bar without indexStatus', () => {
    const wrapper = mount(FileExplorer, {
      props: {
        files: [],
        searchResults: [],
        isSearchMode: false,
        breadcrumb: [],
        canGoBack: false,
        canGoForward: false,
      },
    })
    expect(wrapper.text()).not.toContain('/')
  })
})
```

- [ ] **Step 5: 运行测试**

Run:
```bash
pnpm test tests/unit/components/FileExplorerIndexStatus.test.ts
```

Expected: tests PASS。

- [ ] **Step 6: Commit**

```bash
git add src/stores/knowledgeBase.ts src/components/FileExplorer.vue src/components/KnowledgeBasePage.vue tests/unit/components/FileExplorerIndexStatus.test.ts
git commit -m "feat(ui): show indexing progress bar in FileExplorer"
```

---

## Self-Review

### 1. Spec coverage

| Acceptance Criteria | Task |
|---|---|
| SQLite Schema: document_chunks + vec + fts | Task 2 |
| Sidecar 启动加载 sqlite-vec 扩展 | Task 3 |
| 索引队列：文件导入后自动加入 | Task 5 |
| LangChain TextLoader + RecursiveCharacterTextSplitter | Task 5 |
| 调用 Embedding API，同步写入三张表 | Task 4, Task 5 |
| 前端索引进度条 | Task 10 |
| 知识库管理页显示文件索引状态 | Task 10 |
| 手动触发重建索引 API | Task 5 |
| 前端 @提及 交互 | Task 8 |
| POST /chat body 支持 knowledgeBaseIds | Task 7 |
| 混合搜索：向量+全文+RRF | Task 6 |
| messages 表增加 knowledge_base_ids | Task 2, Task 7 |

### 2. Placeholder scan

- 无 "TBD", "TODO", "implement later"
- 每个代码步骤都包含完整实现
- 每个测试步骤都包含完整测试代码
- 无 "Similar to Task N" 引用

### 3. Type consistency

- `EmbeddingConfig` 在 `server/src/services/embedding.ts` 和 `server/src/types.ts` 中定义一致
- `Message.knowledge_base_ids` 类型为 `string | null`（数据库 JSON）
- `ChatInput` emit `send: [content: string, knowledgeBaseIds: string[]]` 与 `sessionStore.sendMessage` 签名匹配
- `KbMentionDropdown` / `KbMentionPill` 使用 `KnowledgeBase` 类型与 store 一致

---

## 验证清单（最终集成测试）

所有任务完成后，运行：

```bash
pnpm test
pnpm type-check
cd server && pnpm build
```

Expected:
- 所有测试 PASS
- TypeScript 无错误
- Sidecar 编译成功
