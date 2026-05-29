# API 规格：RAG 真实集成测试

## 测试基础设施接口

### TestAppFactory.create 扩展（向后兼容）

```typescript
interface CreateAppOptions {
  realMode?: boolean  // 新增：true 时连接真实外部服务，默认 false
}

// 签名变更：create(dbUrl: string, opts?: CreateAppOptions)
// realMode=true 时不 Mock 以下服务：
// - VectorService (Milvus)
// - KeywordService (PostgreSQL FTS)
// - QueueService (BullMQ + Redis)
// - StorageService (MinIO)
// realMode=false（默认）保持现有 Mock 行为，不影响已有测试
```

### 基础设施健康检测

```typescript
interface InfraHealthCheck {
  postgres: boolean   // PG 可连接且可创建数据库
  milvus: boolean     // Milvus 可连接且集合操作正常
  redis: boolean      // Redis 可连接且可读写
  minio: boolean      // MinIO 可连接且可创建 bucket
}

// 检测函数路径：tests/integration/helpers/infra-check.ts
// globalSetup 中执行，任一 false 则在控制台输出跳过原因并优雅退出
// 不抛出错误，避免 CI 失败
```

## 测试数据接口

### 测试文档上传

```typescript
interface TestDocumentUpload {
  filename: string
  contentType: 'text/plain' | 'text/markdown'
  content: string       // 文本内容
  kbId: string          // 知识库 ID
}
```

### 测试检索查询

```typescript
interface TestRetrievalQuery {
  query: string         // 自然语言查询
  kbIds: string[]       // 知识库 ID 列表
  topK?: number         // 默认 10
}
```

## 测试文件与映射

| 测试文件 | 说明 | AC 覆盖 |
|----------|------|---------|
| `tests/integration/rag-real.spec.ts` | 真实 RAG 集成测试（新建） | AC-03 ~ AC-05 |
| `tests/integration/helpers/infra-check.ts` | 基础设施健康检测（新建） | AC-01 |
| `tests/integration/helpers/test-app.factory.ts` | TestAppFactory 扩展 realMode | AC-02 |

## 断言标准

### 索引链路断言

```typescript
// 1. 文档状态
const doc = await prisma.document.findUnique({ where: { id: docId } })
expect(doc.status).toBe('ready')

// 2. Chunk 存在
const chunks = await prisma.chunk.findMany({ where: { documentId: docId } })
expect(chunks.length).toBeGreaterThan(0)
expect(chunks[0].content).toBeTruthy()
expect(chunks[0].tokenCount).toBeGreaterThan(0)

// 3. 向量存在
const vectors = await vectorService.search({ kbId, queryVector, topK: 10 })
expect(vectors.length).toBeGreaterThan(0)
```

### 检索链路断言

```typescript
// 1. 候选非空
const candidates = await retriever.retrieve({ original: query, kbIds }, 10)
expect(candidates.length).toBeGreaterThan(0)

// 2. 候选含 content（关键：验证 HybridRetriever 返回的候选有实际 content）
expect(candidates[0].chunk.content).toBeTruthy()
expect(candidates[0].score).toBeGreaterThan(0)

// 3. 后处理有效
const processed = await postprocessor.process(candidates, query)
expect(processed.candidates.length).toBeGreaterThan(0)
```
