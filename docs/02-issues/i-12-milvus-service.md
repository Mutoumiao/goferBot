---
id: i-12-milvus-service
type: issue
status: closed
track: infra
priority: p0
summary: 将现有 Milvus 客户端封装为 NestJS Injectable Service，支持依赖注入。VectorModule 和 VectorService 就绪，实现 IVectorStore 接口。
blocked_by: [i-08-nestjs-server-setup]
blocks: []
spec: docs/03-specs/i-12-milvus-service/
plan: docs/04-plans/i-12-milvus-service/v1.md
tests: docs/08-test-cases/i-12-milvus-service/
token_estimate: 800
---

状态: completed
分类: enhancement

## 要构建的内容

将现有 Milvus 客户端封装为 NestJS Injectable Service。

## 背景

i-04-milvus-client 已完成 Milvus 客户端实现，需在 NestJS 中封装为 Service，供其他模块依赖注入。

## 验收标准

- [ ] `src/processors/vector/vector.module.ts` — VectorModule（@Global()）
- [ ] `src/processors/vector/vector.service.ts` — VectorService（@Injectable()）
  - `ensureCollection()` — 检查/创建 collection
  - `insertVectors(vectors)` — 批量插入向量
  - `searchVectors(query, options)` — ANN 搜索
  - `deleteByIds(ids)` — 删除向量
  - `deleteByFileId(fileId)` — 按文件 ID 删除
  - `deleteByKbId(kbId)` — 按知识库 ID 删除
- [ ] 实现 `IVectorStore` 接口
- [ ] 配置从 `ConfigService` 读取（MILVUS_HOST, MILVUS_PORT, MILVUS_COLLECTION, MILVUS_VECTOR_DIM）
- [ ] 复用现有 `src/vector/milvus.ts` 核心逻辑
- [ ] `pnpm type-check` 通过

## 阻塞于

- i-08-nestjs-server-setup（需要 NestJS 模块结构）

## 范围外

- Embedding 生成（由 RAG SDK 负责）
- 混合检索（Phase 5）

## Agent 简报

**分类：** enhancement
**摘要：** Milvus 客户端封装为 NestJS VectorService

**当前行为：**
Milvus 客户端已实现，但为独立模块。

**期望行为：**
Milvus 客户端封装为 NestJS Injectable Service，支持依赖注入。

**关键接口：**
- `VectorService` — 向量存储服务
- `IVectorStore` — 接口实现

**验收标准：**
- [ ] VectorModule/VectorService
- [ ] 实现 IVectorStore
- [ ] ConfigService 配置
- [ ] type-check 通过

**范围外：**
- Embedding 生成
- 混合检索
