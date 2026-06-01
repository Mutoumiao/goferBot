# API 规格：PrismaVectorIndexer

## PrismaVectorIndexer 接口

```typescript
// packages/server/src/processors/indexing/prisma-vector.indexer.ts
export interface TokenUsage {
  promptTokens: number
  totalTokens: number
}

export class PrismaVectorIndexer implements IIndexer {
  constructor(private readonly prisma: PrismaService)

  async index(
    chunks: Chunk[],
    vectors: number[][],
    usage?: TokenUsage[],
  ): Promise<void>
}
```

### SQL 实现

#### index（单事务）

```sql
-- 事务内逐条插入/更新
INSERT INTO chunks (id, document_id, kb_id, content, token_count, chunk_index, embedding)
VALUES (
  ${chunks[i].id},
  ${chunks[i].documentId},
  ${chunks[i].kbId},
  ${chunks[i].content},
  ${tokenCounts[i]},
  ${chunks[i].chunkIndex},
  ${vectors[i]}::vector
)
ON CONFLICT (id) DO UPDATE SET
  document_id = EXCLUDED.document_id,
  kb_id = EXCLUDED.kb_id,
  content = EXCLUDED.content,
  token_count = EXCLUDED.token_count,
  chunk_index = EXCLUDED.chunk_index,
  embedding = EXCLUDED.embedding
```

### TokenCount 计算策略

```typescript
private computeTokenCounts(chunks: Chunk[], usage?: TokenUsage[]): number[] {
  // 方案 A：embedder 提供了逐条 usage
  if (usage && usage.length === chunks.length) {
    return usage.map(u => u.promptTokens)
  }

  // 方案 B：embedder 提供了总量，按文本长度比例分配
  if (usage && usage.length === 1) {
    const totalTokens = usage[0].promptTokens
    const totalLength = chunks.reduce((sum, c) => sum + c.content.length, 0)
    return chunks.map(c =>
      Math.round((c.content.length / totalLength) * totalTokens)
    )
  }

  // 方案 C（回退）：使用 chunker 的估算值
  return chunks.map(c =>
    c.tokenCount ?? Math.ceil(c.content.length / 4)
  )
}
```

### 与 PrismaMilvusIndexer 对比

| 维度 | PrismaMilvusIndexer（旧） | PrismaVectorIndexer（新） |
|------|---------------------------|---------------------------|
| 事务 | 无（先 PG 后 Milvus） | 单 PostgreSQL 事务 |
| 向量位置 | Milvus collection | `chunks.embedding` 列 |
| milvusId | 需要回写 | 无 |
| 依赖 | PrismaService + VectorService | 仅 PrismaService |
| 重试 | 可能重复插入 Milvus | ON CONFLICT 安全 |
| 一致性 | 双写不一致风险 | ACID 保证 |

## 调用方适配

### IndexingWorker

```typescript
// 修改前
const indexer = new PrismaMilvusIndexer(this.prisma, this.vectorService)

// 修改后
const indexer = new PrismaVectorIndexer(this.prisma)
```

### DocumentService.remove()

```typescript
// ADR 0005：chunks 表有 ON DELETE CASCADE，删除 document 自动级联删除
// 无需手动调用 vectorService.deleteByFileId()
async remove(userId: string, kbId: string, docId: string): Promise<void> {
  // ... 权限检查 ...
  await this.prisma.document.delete({ where: { id: docId } })
  // chunks（含 embedding）自动级联删除
}
```

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| 正常索引 | `tests/unit/server/prisma-vector-indexer.spec.ts` | AC-01: 单事务写入 chunks + embedding |
| 重试场景 | `tests/unit/server/prisma-vector-indexer.spec.ts` | AC-02: ON CONFLICT 更新而非报错 |
| 空 chunks | `tests/unit/server/prisma-vector-indexer.spec.ts` | AC-03: 空数组直接返回 |
| tokenCount 精确值 | `tests/unit/server/prisma-vector-indexer.spec.ts` | AC-04: 使用 usage 提供的精确值 |
| tokenCount 回退 | `tests/unit/server/prisma-vector-indexer.spec.ts` | AC-05: 无 usage 时使用估算值 |
