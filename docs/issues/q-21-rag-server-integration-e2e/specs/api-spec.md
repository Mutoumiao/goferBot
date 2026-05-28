---
issue_id: q-21
type: api-spec
status: draft
summary: 定义 RAG Server 集成端到端测试的 API 测试场景、数据准备、断言点与测试映射。覆盖文档上传、索引状态轮询、对话检索注入、无检索回归、索引失败 5 大场景。
---

# API 规格：RAG Server 集成端到端验证

## 测试场景总览

| 场景编号 | 场景名称 | 验证目标 |
|----------|----------|----------|
| TC-01 | 文档上传触发索引 | 上传后 MinIO 存在对象、PG 记录 status='uploaded'、BullMQ 存在 job |
| TC-02 | 索引状态流转至 ready | Worker 处理后 status 变为 'ready'，PG chunks 表有记录，Milvus 有向量 |
| TC-03 | 对话检索上下文注入 | 携带 knowledgeBaseIds 提问，SSE 回答包含文档内容，message 表记录 knowledge_base_ids |
| TC-04 | 无检索对话回归 | 不携带 knowledgeBaseIds，对话行为与现有逻辑一致，message 表 knowledge_base_ids 为 null |
| TC-05 | 索引失败处理 | Embedding API 返回 500，Worker 重试 3 次后 status='failed'，errorMessage 非空 |

---

## 场景 TC-01：文档上传触发索引

### 端点

```
POST /api/knowledge-bases/:kbId/documents
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

#### 请求

```
file: (binary, text/plain, content: "GoferBot RAG integration test content.")
folderId: (optional, null)
```

#### 响应 201

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "kbId": "kb-id",
    "name": "test.txt",
    "status": "uploaded",
    "storageKey": "kb-id/1234567890-test.txt"
  }
}
```

### 数据准备

1. 创建测试用户并登录获取 JWT
2. 创建知识库 `TestKB`
3. 准备文本文件内容：`"GoferBot RAG integration test content."`

### 断言点

| # | 断言内容 | 验证目的 |
|---|----------|----------|
| 1 | HTTP status === 201 | 上传接口正常 |
| 2 | response.data.status === 'uploaded' | 初始状态正确 |
| 3 | MinIO 中 `storageKey` 对应对象存在 | 文件存储成功 |
| 4 | BullMQ documentQueue 中 waiting/active job 数量为 1 | 索引任务已入队 |
| 5 | PG `documents` 表中记录 `size`、`mimeType`、`storageKey` 与请求一致 | 元数据持久化正确 |

---

## 场景 TC-02：索引状态流转至 ready

### 端点

```
GET /api/knowledge-bases/:kbId/documents/:docId
Authorization: Bearer {token}
```

#### 响应 200（索引完成后）

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "ready",
    "errorMessage": null
  }
}
```

### 数据准备

1. 执行 TC-01 完成文档上传
2. 启动 mock embedding server（返回固定 1536 维向量）
3. 确保 Redis、Milvus、Worker 正常运行

### 断言点

| # | 断言内容 | 验证目的 |
|---|----------|----------|
| 1 | 轮询 30 秒内 status 从 'uploaded' 变为 'ready' | 状态流转正确 |
| 2 | PG `chunks` 表中存在该 documentId 的记录，且 `content` 非空 | 分块持久化成功 |
| 3 | PG `chunks` 表中 `milvusId` 非空 | Milvus ID 回写成功 |
| 4 | Milvus 中通过 `fileId` 搜索可返回向量记录 | 向量入库成功 |
| 5 | `chunks` 表 `tokenCount` 字段有值（>= 0） | Token 计数已计算 |
| 6 | 多 chunk 文档验证（content > 512 字符） | 大文件分块正确（补充测试数据长度） |

---

## 场景 TC-03：对话检索上下文注入

### 端点

```
POST /api/chat
Authorization: Bearer {token}
Content-Type: application/json
```

#### 请求

```json
{
  "message": "What does the document say about GoferBot?",
  "sessionId": "550e8400-e29b-41d4-a716-446655440001",
  "knowledgeBaseIds": ["kb-id"],
  "config": {
    "provider": "openai",
    "model": "gpt-4",
    "baseUrl": "http://localhost:{llmMockPort}",
    "apiKey": "mock"
  }
}
```

#### 响应 200（SSE）

```
content-type: text/event-stream

data: {"choices":[{"delta":{"content":"GoferBot"}}]}

data: {"choices":[{"delta":{"content":" RAG"}}]}

data: {"choices":[{"delta":{"content":" integration"}}]}

data: [DONE]
```

### 数据准备

1. 执行 TC-01 + TC-02，确保文档状态为 `ready`
2. 启动 mock LLM server，返回固定内容 `"GoferBot RAG integration test content."`
3. 创建 session 并确认归属当前用户

### 断言点

| # | 断言内容 | 验证目的 |
|---|----------|----------|
| 1 | HTTP status === 200，content-type === `text/event-stream` | SSE 流式输出正常 |
| 2 | 解析 SSE 数据，拼接后的 assistant 内容包含 `"GoferBot"` | 回答基于文档内容 |
| 3 | mock LLM server 收到的请求体中，`messages[0].role === 'system'`，且 `content` 包含 `"GoferBot RAG integration test content"` | 检索上下文已注入 system message |
| 4 | PG `messages` 表中 user 消息记录存在且 `content` 包含请求消息 | 用户消息已持久化（当前 schema 无 `knowledge_base_ids` 字段，该断言在 Phase 2 metadata 扩展后补充） |
| 5 | PG `messages` 表中 assistant 消息记录存在且 `content` 非空 | 回答已持久化 |

---

## 场景 TC-04：无检索对话回归

### 端点

```
POST /api/chat
Authorization: Bearer {token}
Content-Type: application/json
```

#### 请求

```json
{
  "message": "Hello, how are you?",
  "sessionId": "550e8400-e29b-41d4-a716-446655440002",
  "config": {
    "provider": "openai",
    "model": "gpt-4",
    "baseUrl": "http://localhost:{llmMockPort}",
    "apiKey": "mock"
  }
}
```

### 数据准备

1. 创建用户、session
2. 启动 mock LLM server，返回固定内容 `"I am doing well."`

### 断言点

| # | 断言内容 | 验证目的 |
|---|----------|----------|
| 1 | HTTP status === 200，content-type === `text/event-stream` | SSE 正常 |
| 2 | mock LLM server 收到的请求体中，不存在 `role === 'system'` 的消息 | 无检索上下文注入 |
| 3 | PG `messages` 表中 user 消息记录存在且 `content` 包含请求消息 | 用户消息已持久化（当前 schema 无 `knowledge_base_ids` 字段） |
| 4 | assistant 消息 `content` === `"I am doing well."` | 回答基于模型自身知识 |
| 5 | 响应耗时与携带 `knowledgeBaseIds` 时差异在 500ms 以内（排除网络抖动） | 无额外检索开销导致明显延迟 |

---

## 场景 TC-05：索引失败处理

### 端点

```
GET /api/knowledge-bases/:kbId/documents/:docId
Authorization: Bearer {token}
```

#### 响应 200（索引失败后）

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "failed",
    "errorMessage": "Embedding API error: 500"
  }
}
```

### 数据准备

1. 创建用户、知识库
2. 上传文档（同 TC-01）
3. 启动 mock embedding server，对 `/v1/embeddings` 返回 HTTP 500

### 断言点

| # | 断言内容 | 验证目的 |
|---|----------|----------|
| 1 | 轮询 60 秒内 status 变为 'failed' | 失败状态被正确标记 |
| 2 | `errorMessage` 非空且包含 `"Embedding API error"` | 错误原因已记录 |
| 3 | BullMQ job state 为 'failed'，且 `attemptsMade === 3` | 重试 3 次后放弃 |
| 4 | PG `chunks` 表中该 documentId 的 `milvusId` 全为 `null`（若存在 orphan chunks）或记录数为 0（若 b-11 采用先 Milvus 后 PG 顺序） | 失败时未建立 chunk-vector 关联 |
| 5 | Milvus 中该 `fileId` 无向量记录 | 失败时未写入脏向量 |

---

## 测试数据规范

### 用户数据

| 字段 | 值 | 说明 |
|------|-----|------|
| email | `q21-test@gofer.bot` | 固定前缀，便于测试后清理 |
| password | `Test1234!` | 符合密码强度规则 |
| name | `Q21 Tester` | — |

### 知识库数据

| 字段 | 值 | 说明 |
|------|-----|------|
| name | `Q21-TestKB-{uuid}` | 避免并发冲突（使用 `crypto.randomUUID()`） |
| description | `RAG integration test KB` | — |

### 文档数据

| 字段 | 值 | 说明 |
|------|-----|------|
| filename | `rag-test.txt` | — |
| mimeType | `text/plain` | 纯文本，解析无依赖 |
| content | `"GoferBot RAG integration test content. This text is intentionally repeated to ensure sufficient length for chunking and embedding pipeline validation. "` 重复 10 次 | 长度 > 512 字符，确保产生多个 chunks |

### Mock Embedding Server 响应

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "embedding": [0.1, 0.1, 0.1, ...],
      "index": 0
    }
  ],
  "model": "text-embedding-3-small",
  "usage": {
    "prompt_tokens": 20,
    "total_tokens": 20
  }
}
```

- `embedding` 长度必须等于 `MILVUS_VECTOR_DIM`（默认 1536）

### Mock LLM Server 响应

SSE 流：

```
data: {"choices":[{"delta":{"role":"assistant"}}]}

data: {"choices":[{"delta":{"content":"GoferBot"}}]}

data: {"choices":[{"delta":{"content":" RAG"}}]}

data: {"choices":[{"delta":{"content":" integration"}}]}

data: {"choices":[{"delta":{"content":" test"}}]}

data: {"choices":[{"delta":{"content":" content"}}]}

data: {"choices":[{"delta":{"content":"."}}]}

data: [DONE]
```

---

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| TC-01 文档上传触发索引 | `tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts` | `AC-01: upload triggers document job and sets status uploaded` |
| TC-02 索引状态流转至 ready | `tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts` | `AC-02: worker processes job and status becomes ready with chunks and vectors` |
| TC-03 对话检索上下文注入 | `tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts` | `AC-03: chat with knowledgeBaseIds injects retrieval context into SSE` |
| TC-04 无检索对话回归 | `tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts` | `AC-04: chat without knowledgeBaseIds behaves identically to baseline` |
| TC-05 索引失败处理 | `tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts` | `AC-05: embedding API failure leads to failed status after 3 retries` |
| 跨知识库检索 | `tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts` | `AC-06: chat with multiple knowledgeBaseIds retrieves across all specified KBs` |
| 空检索结果降级 | `tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts` | `AC-07: chat with knowledgeBaseIds but no matching chunks falls back to baseline` |
| 上传文件超过大小限制 | `tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts` | `AC-08: rejects file exceeding size limit` |
| 知识库不存在 | `tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts` | `AC-09: returns 404 for non-existent kb on upload` |
| 会话不存在 | `tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts` | `AC-10: returns 400 for non-existent session on chat` |
| 无权访问知识库 | `tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts` | `AC-11: returns 403 when user does not own kb` |
| Milvus 连接断开 | `tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts` | `AC-12: handles Milvus disconnect gracefully` |

---

## 环境要求

### 必需环境变量

```bash
export TEST_DATABASE_ADMIN_URL="postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/postgres?schema=public"
export DATABASE_URL="postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_test?schema=public"
export REDIS_HOST="127.0.0.1"
export REDIS_PORT="6379"
export MILVUS_HOST="127.0.0.1"
export MILVUS_PORT="19530"
export MILVUS_COLLECTION="test_chunks"
export MILVUS_VECTOR_DIM="1536"
export MINIO_ENDPOINT="127.0.0.1:9000"
export MINIO_ACCESS_KEY="minioadmin"
export MINIO_SECRET_KEY="minioadmin"
export MINIO_BUCKET="goferbot-test"
```

### Docker 基础设施启动

```bash
pnpm infra:up
```

确认服务：

```bash
docker compose -f docker-compose.dev.yml ps
```

### 测试执行

```bash
# 单个 issue 测试
pnpm vitest run --config vitest.integration.config.ts tests/issues/q-21-rag-server-integration-e2e/

# 单个用例
pnpm vitest run --config vitest.integration.config.ts -t "AC-03"
```

---

## 错误码与异常场景

| 场景 | HTTP 状态 | 响应体 | 测试断言 |
|------|-----------|--------|----------|
| 上传文件超过大小限制 | 413 | `{ "error": "..." }` | `AC-08: rejects file exceeding size limit` |
| 知识库不存在 | 404 | `{ "error": "..." }` | `AC-09: returns 404 for non-existent kb on upload` |
| 会话不存在 | 400 | `{ "error": "..." }` | `AC-10: returns 400 for non-existent session on chat` |
| 无权访问知识库 | 403 | `{ "error": "..." }` | `AC-11: returns 403 when user does not own kb` |
| Milvus 连接断开 | 500（SSE 中断） | — | `AC-12: handles Milvus disconnect gracefully` |

---

## 异步行为说明

### 索引任务生命周期

1. `DocumentService.upload()` 成功后调用 `QueueService.addDocumentJob(doc.id, 'index')`
2. BullMQ 将 job 放入 `document-processing` 队列
3. `IndexingWorker.handleIndexJob()` 消费 job：
   - 下载文件 -> 解析 -> 分块 -> 向量化 -> 入库
   - 每阶段通过 `onStageChange` 回调更新 `document.status`
4. 完成后 status='ready'，失败（重试 3 次后）status='failed'

### 客户端轮询状态

测试中使用轮询而非 WebSocket：

```typescript
async function waitForDocumentStatus(
  app: NestFastifyApplication,
  token: string,
  kbId: string,
  docId: string,
  targetStatus: 'ready' | 'failed',
  timeoutMs = 30000,
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/knowledge-bases/${kbId}/documents/${docId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    const json = res.json()
    if (json.data?.status === targetStatus) return
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Timeout waiting for document status ${targetStatus}`)
}
```
