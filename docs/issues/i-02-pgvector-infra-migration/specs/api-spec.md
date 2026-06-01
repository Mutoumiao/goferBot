# API 规格：pgvector 基础设施迁移

## 数据库 Schema 变更

### Chunk 模型（Prisma）

```prisma
model Chunk {
  id         String                      @id @default(uuid())
  documentId String                      @map("document_id")
  kbId       String                      @map("kb_id")
  content    String
  tokenCount Int?                        @map("token_count")
  chunkIndex Int                         @map("chunk_index")
  embedding  Unsupported("vector(1536)")?
  createdAt  DateTime                    @default(now()) @map("created_at")

  document      Document      @relation(fields: [documentId], references: [id], onDelete: Cascade)
  knowledgeBase KnowledgeBase @relation(fields: [kbId], references: [id], onDelete: Cascade)

  @@map("chunks")
  @@index([kbId])
  @@index([documentId])
}
```

### 变更点

| 字段 | 旧 | 新 |
|------|----|----|
| `milvusId` | `String?` | **移除** |
| `embedding` | 无 | **新增** `Unsupported("vector(1536)")?` |

### HNSW 索引（SQL 迁移中创建）

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE INDEX "chunks_embedding_hnsw" ON "chunks"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

## 环境变量变更

### 移除变量

| 变量 | 原用途 |
|------|--------|
| `MILVUS_HOST` | Milvus 连接地址 |
| `MILVUS_PORT` | Milvus 端口 |
| `MILVUS_COLLECTION` | Milvus collection 名称 |
| `MILVUS_VECTOR_DIM` | 向量维度 |

### 保留变量

| 变量 | 用途 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接（已包含 pgvector） |
| `REDIS_HOST` / `REDIS_PORT` | Redis 连接 |
| `MINIO_HOST` / `MINIO_PORT` | MinIO 连接 |

## Docker Compose 服务变更

### 移除服务

- `milvus`：Milvus standalone 容器

### 修改服务

- `postgres`：镜像从 `postgres:16-alpine` 改为 `pgvector/pgvector:pg16`

### 保留服务

- `minio`
- `redis`

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| Schema 变更 | 无自动化测试 | 人工验证：prisma migrate dev + db pull |
| Docker 启动 | 无自动化测试 | 人工验证：docker-compose up + psql 检查扩展 |
| 环境变量 | 无自动化测试 | 人工验证：.env.example 无 MILVUS_* |
