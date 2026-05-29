# 功能规格：RAG 真实集成测试

## 概述

为 RAG 核心链路建立真实基础设施上的集成测试，验证索引和检索端到端行为。

## 用户故事

作为开发者，我希望在真实基础设施上运行 RAG 集成测试，以便在部署前发现 Mock 测试无法捕获的集成问题。

## 功能边界

### 范围内

- 真实 PostgreSQL 数据库（动态创建隔离测试库）
- 真实 Milvus 向量数据库（向量插入与 ANN 检索）
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
| AC-01 | 基础设施检测：globalSetup 检测 PG/Milvus/Redis/MinIO，任一不可用时测试套件跳过且不报错 | P0 |
| AC-02 | 真实模式扩展：TestAppFactory 支持 `realMode: true` 参数，连接真实外部服务 | P0 |
| AC-03 | 索引链路：文本文件上传后，经过解析→分块→嵌入，最终 PG Chunk 表和 Milvus 均有数据，document status = ready | P0 |
| AC-04 | 检索链路：向量化查询后，HybridRetriever 返回有效候选（含 content、score、chunkId） | P0 |
| AC-05 | 失败降级：zhparser 未安装时 KeywordService 降级为 simple config；Milvus 不可用时向量检索返回空数组不崩溃 | P1 |
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
| 四服务全检测（PG+Milvus+Redis+MinIO） | q-21 仅检测 DATABASE_URL 过于宽松，q-22 需显式检测所有依赖 | 是 |
| 继续 Mock Embedding API | 避免外部网络依赖和费用，保证测试稳定性 | 是 |
