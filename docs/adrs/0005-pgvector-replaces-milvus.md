# ADR 0005: pgvector 替代 Milvus 作为向量存储

## 状态

已接受

## 背景

ADR 0004 确立了云原生架构，其中向量存储选用 Milvus（独立 Docker 服务）。经过 RAG SDK 与 Server 的完整集成（d-11 ~ q-22 已关闭），实际运行中暴露出以下结构性问题：

1. **双写无事务**：`PrismaMilvusIndexer` 先写 PostgreSQL chunks 表，再写 Milvus collection，中间任何失败导致元数据与向量不一致
2. **冗余服务**：Milvus 仅用于存储 `id, chunk_id, kb_id, file_id, embedding` 五个字段的 ANN 搜索，无使用 Milvus 高级功能（分区、多向量、GPU 加速）
3. **网络往返**：检索时需先访问 Milvus 获取 chunk_id，再回查 PostgreSQL 获取 content，至少 2 次网络往返
4. **运维负担**：Docker Compose 需维护 Milvus 容器（内嵌 etcd + 依赖 MinIO），启动耗时 ~30 秒，本地开发资源占用高
5. **数据规模匹配度低**：本项目定位个人/小团队 AI Workspace，单用户文档量通常在数千到数万级别，远低于 Milvus 的优势区间（千万级+）

## 决策

将向量存储从 **Milvus** 迁移至 **PostgreSQL pgvector 扩展**，实现元数据与向量的同库同表存储。

### 变更概要

| 组件 | 旧方案 | 新方案 |
|------|--------|--------|
| 向量存储 | Milvus (Docker 独立服务) | PostgreSQL pgvector 扩展 |
| 向量列位置 | Milvus collection | `chunks.embedding` 列 |
| 索引类型 | Milvus AUTOINDEX | pgvector HNSW (`vector_cosine_ops`) |
| 事务一致性 | 应用层双写，无事务 | PostgreSQL 原生 ACID |
| 混合查询 | 2 次网络往返 | SQL 单表查询 |
| Docker 服务 | PG + MinIO + Milvus + Redis | PG + MinIO + Redis |
| Docker 镜像 | `postgres:16-alpine` | `pgvector/pgvector:pg16` |

### 架构原则调整

ADR 0004 的原则 3「Milvus 只负责向量检索」调整为：

> **PostgreSQL 统一承载元数据与向量，pgvector 提供 ANN 能力。**

其余原则不变。

## 后果

### 正面

- **事务一致性**：元数据与向量在同一 PostgreSQL 事务中写入，彻底消除双写不一致
- **查询简化**：向量搜索 + 内容获取单次 SQL 完成，减少 1 次网络往返
- **运维简化**：移除 Milvus 容器，Docker Compose 服务从 4 个减至 3 个，启动更快
- **依赖瘦身**：移除 `@zilliz/milvus2-sdk-node` 包及 gRPC 连接逻辑
- **混合查询增强**：SQL 直接 JOIN 向量结果与标量过滤，无需应用层协调
- **备份简化**：PostgreSQL 统一备份即可覆盖全部数据

### 负面

- **性能天花板**：pgvector HNSW 在千万级向量以上性能劣于 Milvus，未来超大规模需重新评估
- **Prisma 限制**：Prisma 原生不支持 `vector` 类型，需使用 `Unsupported()` + `$queryRaw` 操作向量列
- **功能缺失**：失去 Milvus 的高级功能（多向量字段、GPU 索引、分布式集群），当前未使用但未来扩展受限

### 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 千万级+ 性能不足 | 中 | 本项目当前及可预见未来数据量在数万级；如增长超预期，可迁移到 pgvector 集群或专用向量库 |
| Prisma `$queryRaw` 维护成本 | 低 | 向量操作封装在 `VectorService` 内，调用方无感知；SQL 逻辑简单稳定 |
| 现有测试依赖 Milvus | 低 | 当前无生产数据，测试基础设施同步更新（q-22 等集成测试移除 Milvus 健康检测） |

## Schema 变更

### chunks 表

```sql
-- 启用扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 添加向量列，移除 milvus_id
ALTER TABLE "chunks"
  ADD COLUMN "embedding" vector(1536),
  DROP COLUMN "milvus_id";

-- HNSW 索引（COSINE 相似度）
-- 注：OpenAI text-embedding-3 系列输出已归一化（L2 范数 = 1），
-- 因此 1 - L2_distance 等价于 cosine_similarity。
-- 若未来使用非归一化模型，需改用 <=> 余弦操作符或显式归一化。
CREATE INDEX "chunks_embedding_hnsw" ON "chunks"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### Prisma Schema

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

## 代码变更范围

| 文件/目录 | 操作 | 说明 |
|-----------|------|------|
| `packages/server/src/vector/milvus.ts` | 删除 | Milvus 客户端封装 |
| `packages/server/src/vector/pgvector.ts` | 新增 | pgvector 原始 SQL 封装 |
| `packages/server/src/processors/vector/vector.service.ts` | 重写 | 委托给 PgVectorStore |
| `packages/server/src/processors/indexing/prisma-milvus.indexer.ts` | 重写 → `prisma-vector.indexer.ts` | 单事务写入 PG |
| `packages/rag-sdk/src/indexers/milvus.indexer.ts` | 重命名 → `vector.indexer.ts` | 解耦 Milvus 特化命名 |
| `docker-compose.dev.yml` | 编辑 | 移除 milvus 服务，postgres 改用 `pgvector/pgvector:pg16` |
| `packages/server/.env.example` | 编辑 | 移除 `MILVUS_*` 变量 |
| `packages/server/package.json` | 编辑 | 移除 `@zilliz/milvus2-sdk-node` |
| `tests/integration/rag-real.spec.ts` | 编辑 | 移除 Milvus 健康检测，改为 pgvector 扩展检测 |

## 接口语义调整

### `IVectorStore.ensureCollection()`

pgvector 无"collection"概念，但 `IVectorStore` 接口保留此方法以保持抽象一致性。在 pgvector 实现中，`ensureCollection()` 语义调整为：

```typescript
async ensureCollection(): Promise<void> {
  // 确保 pgvector 扩展已安装
  await this.prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`
  // 可选：验证 HNSW 索引存在（迁移已创建，通常无需额外检查）
}
```

### `deleteByFileId()` / `deleteByKbId()` 移除

原 `MilvusVectorStore` 提供的这两个扩展方法在 pgvector 下**不再需要**：

- `chunks` 表已定义 `ON DELETE CASCADE` 外键（`chunks_document_id_fkey`、`chunks_kb_id_fkey`）
- 删除 `documents` 或 `knowledge_bases` 记录时，关联的 `chunks`（含 `embedding`）自动级联删除
- `DocumentService.remove()` 简化为单条 `prisma.document.delete()`，无需手动清理向量

## 兼容性说明

- **IVectorStore 接口保留**：虽然 pgvector 与 PostgreSQL 合一，但 `IVectorStore` 抽象仍提供未来切换的灵活性
- **无数据迁移**：当前无生产数据，直接重建 schema 即可
- **API 不变**：向量存储的切换对上层 API 完全透明

## 相关决策

- [ADR 0004](0004-cloud-native-rearchitecture.md) — 本 ADR 是对 ADR 0004 中向量存储选择的修正
- [PRD: RAG Server 集成](../prd/rag-server-integration.md) — 需同步更新其中 Milvus 相关描述

## 变更记录

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-06-01 | 初始决策：接受 pgvector 替代 Milvus | 架构评估 |
