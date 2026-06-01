# 功能规格：RAG 真实集成测试

## 概述

为 RAG 核心链路建立真实基础设施上的集成测试，验证索引和检索端到端行为。

## 用户故事

作为开发者，我希望在真实基础设施上运行 RAG 集成测试，以便在部署前发现 Mock 测试无法捕获的集成问题。

## 功能边界

### 范围内

- 真实 PostgreSQL 数据库（动态创建隔离测试库）
- 真实 PostgreSQL pgvector 扩展（向量存储与 ANN 检索）
- 真实 Redis + BullMQ（异步任务队列）
- 真实 MinIO（文件上传与下载）
- 索引链路端到端验证
- 检索链路端到端验证
- 基础设施不可用时优雅跳过

### 范围外

- 前端 UI 测试（已由 f-16 覆盖）
- LLM API 真实调用（继续 Mock，避免费用和延迟）
- 性能基准测试（后续阶段）
- 并发/压力测试（后续阶段）

## 验收标准

| ID | 标准 | 优先级 |
|----|------|--------|
| AC-01 | 基础设施检测：检测 PG/pgvector/Redis/MinIO，任一不可用时测试套件跳过且不报错 | P0 |
| AC-02 | 真实模式扩展：TestAppFactory 支持 `realMode: true` 参数，连接真实外部服务 | P0 |
| AC-03 | 索引链路：文本文件上传后，经过解析→分块→嵌入，最终 PG Chunk 表的 embedding 列有数据，document status = ready | P0 |
| AC-04 | 检索链路：向量化查询后，Chat API 返回 SSE 响应，验证检索链路可用 | P0 |
| AC-05 | 失败降级：Embedding API 不可用时，Worker 处理失败，document status 变为 failed，系统不崩溃 | P1 |
| AC-06 | 类型检查：pnpm type-check 全部通过 | P0 |
| AC-07 | 全部测试：npx vitest run 通过（Mock 测试 + 真实集成测试） | P0 |

## 技术约束

- 不破坏现有 Mock 测试的快速和稳定性
- 真实集成测试仅在基础设施可用时运行
- 每个测试用例使用独立的数据库命名空间，避免数据污染

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 新建 `tests/integration/rag-real.spec.ts` | `rag-e2e.spec.ts` 是 q-21 的 E2E 骨架，`rag.test.ts` 是旧版 SQLite 测试，新建文件避免污染 | 是 |
| 重构 `TestAppFactory.create(dbUrl, opts?)` | 新增可选 `realMode` 参数，向后兼容，不新建类避免代码重复 | 是 |
| 三服务检测（PG+Redis+MinIO）+ pgvector 扩展检测 | ADR 0005 将向量存储从 Milvus 迁移至 PostgreSQL pgvector | 是 |
| 继续 Mock Embedding API | 避免外部网络依赖和费用，保证测试稳定性 | 是 |

## 架构变更说明

**2026-06-01 更新**：根据 ADR 0005（pgvector 替代 Milvus），本规格已更新：
- 移除 Milvus 相关检测和验证
- 新增 pgvector 扩展检测（通过 PostgreSQL 查询）
- 向量存在性验证改为查询 `chunks.embedding` 列
