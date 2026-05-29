# API 规格：RAG 真实集成测试

## 测试基础设施接口

### TestAppFactory.create 扩展

```typescript
interface CreateAppOptions {
  dbUrl: string
  realMode?: boolean  // 新增： true 时连接真实外部服务
}

// realMode=true 时不 Mock 以下服务：
// - VectorService (Milvus)
// - KeywordService (PostgreSQL FTS)
// - QueueService (BullMQ + Redis)
// - StorageService (MinIO)
```

### 基础设施健康检测

```typescript
interface InfraHealthCheck {
  postgres: boolean   // PG 可连接
  milvus: boolean     // Milvus 可连接
  redis: boolean      // Redis 可连接
  minio: boolean      // MinIO 可连接
}

// globalSetup 中执行，任一 false 则跳过真实集成测试套件
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

// 2. 候选含 content
expect(candidates[0].chunk.content).toBeTruthy()
expect(candidates[0].score).toBeGreaterThan(0)

// 3. 后处理有效
const processed = await postprocessor.process(candidates, query)
expect(processed.candidates.length).toBeGreaterThan(0)
```
