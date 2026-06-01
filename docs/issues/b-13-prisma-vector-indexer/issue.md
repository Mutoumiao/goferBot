---
id: b-13
status: closed
track: backend
priority: p0
summary: 重写 PrismaVectorIndexer，实现单事务写入 chunks 元数据与向量到 PostgreSQL
blocked_by:
  - b-12
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

将 `PrismaMilvusIndexer` 重写为 `PrismaVectorIndexer`，实现元数据与向量在同一 PostgreSQL 事务中写入。

包含：
- 新建 `PrismaVectorIndexer` 类（`packages/server/src/processors/indexing/prisma-vector.indexer.ts`）
- 修改调用方使用 `PrismaVectorIndexer`
- 单元测试覆盖索引全流程

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 验收标准

- [ ] `PrismaVectorIndexer` 实现 SDK `IIndexer` 接口
- [ ] `index()` 方法使用单事务写入 chunks 元数据 + embedding 向量
- [ ] 优先使用 embedder 提供的精确 `tokenCount`，无 usage 时回退到 chunker 估算值
- [ ] 支持 `ON CONFLICT` 处理 Worker 重试场景
- [ ] 不依赖 `VectorService`（直接操作 Prisma `$executeRaw`）
- [ ] 单元测试覆盖正常索引、重试、空 chunks
- [ ] `pnpm type-check` 通过

## 阻塞于

- b-12：需要 PgVectorStore 和 pgvector 数据库就绪

## 范围外

- 删除 `PrismaMilvusIndexer`（i-03 处理）
- `DocumentService` 修改（调用方自行适配）

## 范围内（调用方适配）

- `IndexingWorker` 修改：注入 `PrismaVectorIndexer` 替代 `PrismaMilvusIndexer`
- `QueueModule` 修改：提供 `PrismaVectorIndexer` 替代 `PrismaMilvusIndexer`

## Agent 简报

**分类：** enhancement
**摘要：** 重写 Indexer 为单事务 pgvector 写入，消除双写不一致

**当前行为：**
- `PrismaMilvusIndexer` 先写 PostgreSQL chunks 表（无 embedding）
- 再调用 `VectorService.insertVectors()` 写 Milvus
- 中间任何失败导致元数据与向量不一致
- 需要 `milvusId` 回写

**期望行为：**
- `PrismaVectorIndexer` 使用 `$transaction` + `$executeRaw`
- 单事务同时写入 chunks 元数据和 embedding 向量
- 无 milvusId，chunk.id 即为主键
- 不依赖 VectorService

**关键接口：**
- `IIndexer`（SDK 接口）
- `Chunk` / `TokenUsage`

**验收标准：**
- [ ] 单事务写入
- [ ] ON CONFLICT 支持
- [ ] tokenCount 优先级正确
- [ ] 单元测试通过

**范围外：**
- PrismaMilvusIndexer 删除（i-03 处理）
- DocumentService 修改

**范围内（调用方适配）：**
- IndexingWorker 注入 PrismaVectorIndexer
- QueueModule 提供 PrismaVectorIndexer
