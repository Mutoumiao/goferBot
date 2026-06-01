# 功能规格：PgVectorStore 与 VectorService

## 概述

实现基于 PostgreSQL pgvector 的向量存储类 `PgVectorStore`，并切换 `VectorService` 使用新实现，完成向量存储层的架构迁移。

## 功能边界

### 范围内

- `PgVectorStore` 类实现（insert/search/delete/ensureCollection）
- `VectorService` 切换至 `PgVectorStore`
- 单元测试

### 范围外

- `MilvusVectorStore` 删除（i-03 处理）
- `PrismaMilvusIndexer` 修改（b-13 处理）
- 应用层调用方修改（ChatService 等）

## 验收标准

| ID | 标准 | 优先级 |
|----|------|--------|
| AC-01 | `PgVectorStore` 实现 SDK `IVectorStore` 全部方法 | P0 |
| AC-02 | `insertVectors` 使用 `$executeRaw` 将向量写入 `chunks.embedding` 列 | P0 |
| AC-03 | `searchVectors` 使用 HNSW 索引执行 cosine 相似度搜索，返回带 score 的结果 | P0 |
| AC-04 | `deleteByIds` 删除指定 chunk 记录 | P0 |
| AC-05 | `ensureCollection` 幂等创建 pgvector 扩展 | P0 |
| AC-06 | `VectorService` 使用 `PgVectorStore`，不再引用 `MilvusVectorStore` | P0 |
| AC-07 | 单元测试覆盖 insert/search/delete/ensureCollection | P0 |
| AC-08 | `pnpm type-check` 通过 | P0 |

## 技术约束

- 使用 Prisma `$queryRaw` / `$executeRaw` 操作向量列
- 向量维度固定 1536（OpenAI text-embedding-3 系列）
- 使用 `vector_cosine_ops` 操作符（OpenAI embedding 已归一化）
- 搜索时按 kbId 过滤（`WHERE kb_id = ANY(...)`）

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 保留 `MilvusVectorStore` 文件 | 降低回滚风险，i-03 统一删除 | 是 |
| 移除 `deleteByFileId` / `deleteByKbId` | ADR 0005 决策：由 ON DELETE CASCADE 处理 | 否 |
| 使用 `1 - embedding <=> query` 计算 cosine similarity | OpenAI embedding 已归一化，L2 distance 等价于 cosine distance | 是（可改 `<=>`） |
