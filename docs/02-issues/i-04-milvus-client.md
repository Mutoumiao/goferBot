---
id: i-04-milvus-client
type: issue
status: needs-triage
track: infra
priority: p1
summary: 封装 Milvus Client，提供 Collection 管理、向量插入、ANN 搜索等操作。后端可通过统一接口操作 Milvus，支持向量插入和带过滤条件的 ANN 搜索。
blocked_by: [i-00-core-interfaces, i-01-docker-compose-infra]
blocks: []
spec: docs/03-specs/i-04-milvus-client/
plan: docs/04-plans/i-04-milvus-client/v1.md
tests: docs/08-test-cases/i-04-milvus-client/
token_estimate: 1000
---

状态: needs-triage
分类: enhancement

## 要构建的内容

封装 Milvus Client，提供 Collection 管理、向量插入、ANN 搜索等操作。

## 规格引用

- 功能规格: docs/03-specs/i-04-milvus-client/feature-spec.md
- 行为规格: docs/03-specs/i-04-milvus-client/behavior-spec.md
- API 规格: 无（基础设施，无 API）

## 验收标准

- [ ] `packages/server/src/vector/milvus.ts` 封装 Milvus Client
- [ ] 提供 `ensureCollection()` 方法，自动创建 `knowledge_chunks` Collection（不存在时）
- [ ] Collection 字段与 PRD 一致：id、chunk_id、kb_id、file_id、embedding(FLOAT_VECTOR)（维度从配置读取，不硬编码）
- [ ] 提供 `insertVectors(vectors)` 方法批量插入向量
- [ ] 提供 `searchVectors(query, kbIds, topK)` 方法执行 ANN 搜索（带 kb_id filter）
- [ ] 提供 `deleteByIds(ids)` 方法删除指定向量
- [ ] 配置从环境变量读取（host、port）
- [ ] 提供类型安全的接口定义
- [ ] 启动时检查 Milvus 连接，失败时给出明确错误

## 阻塞于

- i-00-core-interfaces（需要实现 IVectorStore 接口）
- i-01-docker-compose-infra（需要 Milvus 服务运行）

## 范围外

- 混合检索（向量 + 关键词，Phase 5）
- Rerank 逻辑
- 多 Collection 支持

## Agent 简报

**分类：** enhancement
**摘要：** 封装 Milvus Client，提供向量存储与 ANN 搜索能力

**当前行为：**
项目无向量数据库访问层。

**期望行为：**
后端可通过统一接口操作 Milvus，支持向量插入和带过滤条件的 ANN 搜索。

**关键接口：**
- `packages/server/src/vector/milvus.ts` — Milvus Client 封装
- `ensureCollection()` — 自动创建 Collection
- `insertVectors(vectors)` — 批量插入向量
- `searchVectors(query, kbIds, topK)` — ANN 搜索
- `deleteByIds(ids)` — 删除向量

**验收标准：**
- [ ] `packages/server/src/vector/milvus.ts` 封装 Milvus Client
- [ ] 提供 `ensureCollection()` 方法
- [ ] Collection 字段与 PRD 一致
- [ ] 提供 `insertVectors` 方法
- [ ] 提供 `searchVectors` 方法（带 kb_id filter）
- [ ] 提供 `deleteByIds` 方法
- [ ] 配置从环境变量读取
- [ ] 提供类型安全的接口定义
- [ ] 启动时检查连接

**范围外：**
- 混合检索
- Rerank 逻辑
- 多 Collection 支持
