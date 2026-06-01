# API 规格：PgVectorStore 与 VectorService

## PgVectorStore 接口

```typescript
// packages/server/src/vector/pgvector.ts
export class PgVectorStore implements IVectorStore {
  constructor(private readonly prisma: PrismaService)

  async ensureCollection(): Promise<void>
  async insertVectors(records: VectorRecord[]): Promise<void>
  async searchVectors(
    queryVector: number[],
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]>
  async deleteByIds(ids: string[]): Promise<void>
}
```

### SQL 实现

#### ensureCollection

```sql
CREATE EXTENSION IF NOT EXISTS vector
```

#### insertVectors

> **ADR 0005 后职责变更**：向量插入主要由 `PrismaVectorIndexer` 处理（单事务写入元数据+向量）。
> `PgVectorStore.insertVectors` 保留以实现 `IVectorStore` 接口，但实际调用场景减少。

```sql
INSERT INTO chunks (id, document_id, kb_id, content, token_count, chunk_index, embedding)
VALUES (${id}, ${documentId}, ${kbId}, ${content}, ${tokenCount}, ${chunkIndex}, ${embedding}::vector)
ON CONFLICT (id) DO UPDATE SET
  content = EXCLUDED.content,
  token_count = EXCLUDED.token_count,
  embedding = EXCLUDED.embedding
```

#### searchVectors

```sql
SELECT 
  id,
  document_id as "documentId",
  kb_id as "kbId",
  content,
  token_count as "tokenCount",
  chunk_index as "chunkIndex",
  1 - (embedding <=> ${queryVector}::vector) as score
FROM chunks
WHERE kb_id = ANY(${kbIds}::uuid[])
  AND embedding IS NOT NULL
ORDER BY embedding <=> ${queryVector}::vector
LIMIT ${topK}
```

> **注意**：`1 - (embedding <=> query)` 计算 cosine similarity。`<=>` 是 pgvector 的 cosine distance 操作符。
> OpenAI text-embedding-3 系列输出已归一化（L2 范数 = 1），因此 cosine distance 等价于 L2 distance。
> 若未来使用非归一化模型，需评估是否改用 `<#>`（negative inner product）或显式归一化。

#### deleteByIds

```sql
DELETE FROM chunks WHERE id = ANY(${ids}::uuid[])
```

## VectorService 变更

```typescript
// packages/server/src/processors/vector/vector.service.ts
@Injectable()
export class VectorService implements IVectorStore, OnModuleInit {
  private readonly store: PgVectorStore  // 替代 MilvusVectorStore

  constructor(private readonly prisma: PrismaService) {
    this.store = new PgVectorStore(prisma)
  }

  // 委托给 PgVectorStore
  async ensureCollection(): Promise<void> { return this.store.ensureCollection() }
  async insertVectors(vectors: VectorRecord[]): Promise<void> { return this.store.insertVectors(vectors) }
  async searchVectors(queryVector: number[], options?: VectorSearchOptions): Promise<VectorSearchResult[]> {
    return this.store.searchVectors(queryVector, options)
  }
  async deleteByIds(ids: string[]): Promise<void> { return this.store.deleteByIds(ids) }

  // 移除 deleteByFileId / deleteByKbId（ADR 0005 决策）
}
```

### 变更点

| 方法 | 旧实现 | 新实现 | 说明 |
|------|--------|--------|------|
| `constructor` | `new MilvusVectorStore(config)` | `new PgVectorStore(prisma)` | 依赖注入 PrismaService |
| `onModuleInit` | 检查 Milvus 健康 | 调用 `ensureCollection()` | 创建 pgvector 扩展 |
| `ensureCollection` | Milvus create collection | `CREATE EXTENSION IF NOT EXISTS vector` | 幂等 |
| `insertVectors` | Milvus insert | `INSERT INTO chunks ...` | 直接写 PG（Indexer 优先使用） |
| `searchVectors` | Milvus ANN search | `SELECT ... ORDER BY embedding <=> query` | HNSW 索引 |
| `deleteByIds` | Milvus delete | `DELETE FROM chunks` | 直接删 PG |
| `deleteByFileId` | Milvus delete by file_id | **移除** | ON DELETE CASCADE 处理 |
| `deleteByKbId` | Milvus delete by kb_id | **移除** | ON DELETE CASCADE 处理 |

## 与 PrismaVectorIndexer 的职责划分

| 操作 | PgVectorStore | PrismaVectorIndexer | 说明 |
|------|---------------|---------------------|------|
| 插入（含元数据） | ❌ | ✅ | Indexer 单事务写入 |
| 搜索 | ✅ | ❌ | VectorStore 专用 |
| 删除 | ✅ | ❌ | VectorStore 专用 |
| ensureCollection | ✅ | ❌ | VectorStore 专用 |

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| ensureCollection | `tests/unit/server/pgvector-store.spec.ts` | AC-01: 幂等创建 pgvector 扩展 |
| insertVectors | `tests/unit/server/pgvector-store.spec.ts` | AC-02: 插入向量后 chunks.embedding 有数据 |
| searchVectors | `tests/unit/server/pgvector-store.spec.ts` | AC-03: 搜索返回按相似度排序的结果 |
| deleteByIds | `tests/unit/server/pgvector-store.spec.ts` | AC-04: 删除后记录不存在 |
| VectorService 切换 | `tests/unit/server/vector-service.spec.ts` | AC-05: VectorService 使用 PgVectorStore |
| HybridRetriever 兼容 | `tests/unit/server/chat-service.spec.ts` | AC-06: HybridRetriever 与 PgVectorStore 兼容 |
