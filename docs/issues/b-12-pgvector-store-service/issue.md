---
id: b-12
status: closed
track: backend
priority: p0
summary: 新建 PgVectorStore 类并切换 VectorService，实现 SDK IVectorStore 接口的 pgvector 版本
blocked_by:
  - i-02
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

实现基于 PostgreSQL pgvector 的向量存储，替换现有的 MilvusVectorStore。

包含：
- 新建 `PgVectorStore` 类（`packages/server/src/vector/pgvector.ts`）
- 修改 `VectorService` 使用 `PgVectorStore` 替代 `MilvusVectorStore`
- 保留 `MilvusVectorStore` 文件（阶段 6 i-03 删除）
- 单元测试覆盖 insert/search/delete/ensureCollection

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 验收标准

- [ ] `PgVectorStore` 实现 SDK `IVectorStore` 接口
- [ ] `insertVectors` 使用 `$executeRaw` 将向量写入 `chunks.embedding` 列
- [ ] `searchVectors` 使用 `$queryRaw` 执行 HNSW ANN 搜索
- [ ] `deleteByIds` 使用 `$executeRaw` 删除指定 chunk 记录
- [ ] `ensureCollection` 创建 pgvector 扩展（幂等）
- [ ] `VectorService` 使用 `PgVectorStore`，不再依赖 Milvus
- [ ] 单元测试全部通过
- [ ] `pnpm type-check` 通过

## 阻塞于

- i-02：需要 pgvector 扩展已安装的数据库

## 范围外

- 删除 `MilvusVectorStore`（i-03 处理）
- `deleteByFileId` / `deleteByKbId`（ADR 0005 决策：由 ON DELETE CASCADE 处理）
- Indexer 重写（b-13 处理）

## Agent 简报

**分类：** enhancement
**摘要：** 实现基于 pgvector 的向量存储类，替换 Milvus 依赖

**当前行为：**
- `VectorService` 使用 `MilvusVectorStore` 进行向量操作
- `MilvusVectorStore` 通过 gRPC 连接 Milvus 服务
- 需要 MILVUS_HOST, MILVUS_PORT 等环境变量

**期望行为：**
- `VectorService` 使用 `PgVectorStore` 进行向量操作
- `PgVectorStore` 通过 Prisma `$queryRaw` 操作 PostgreSQL pgvector 列
- 只需 DATABASE_URL 环境变量

**关键接口：**
- `IVectorStore`（SDK 接口）
- `VectorRecord` / `VectorSearchOptions` / `VectorSearchResult`

**验收标准：**
- [ ] PgVectorStore 实现 IVectorStore
- [ ] insertVectors 正确写入 embedding 列
- [ ] searchVectors 返回正确结果
- [ ] VectorService 切换完成
- [ ] 单元测试通过

**范围外：**
- MilvusVectorStore 删除
- Indexer 修改
- 应用层调用方修改
