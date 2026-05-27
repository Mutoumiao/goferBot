# RAG SDK 设计文档

> 本文档目录包含 `@goferbot/rag-sdk` 的完整设计规范，基于 GoferBot 项目现有架构重新整理。

---

## 文档清单

| 序号 | 文档 | 说明 |
|------|------|------|
| 01 | [项目概述与架构定位](01.%20项目概述与架构定位.md) | SDK 在 GoferBot 中的定位、模块划分、与原独立多包方案的差异 |
| 02 | [core 模块设计](02.%20core模块设计.md) | 共享领域契约：类型、Zod Schema、接口、错误、Pipeline 抽象、向量存储接口 |
| 03 | [indexing 模块设计](03.%20indexing模块设计.md) | 离线数据构建：分块、向量化、索引写入、流水线编排 |
| 04 | [runtime 模块设计](04.%20runtime模块设计.md) | 在线检索编排：检索、检索后处理、上下文组装、流水线编排 |
| 05 | [observability 模块设计](05.%20observability模块设计.md) | 可观测性：Trace、Metrics、Observer 接口、Tracer 实现 |
| 06 | [验证体系设计](06.%20验证体系设计.md) | 五层验证闭环：Type / Spec / Unit / Demo / Integration |
| 07 | [目录重构计划](07.%20目录重构计划.md) | 从现有扁平结构到模块化目录的迁移步骤 |

---

## 快速导航

### 如果你是首次阅读

按以下顺序阅读：

1. `01. 项目概述与架构定位.md` — 了解整体架构和模块划分
2. `02. core 模块设计.md` — 了解共享契约（重点看 Query / RetrievalCandidate / IVectorStore 变更）
3. `07. 目录重构计划.md` — 了解如何从现有代码迁移到新结构
4. `03. indexing 模块设计.md` — 了解索引构建
5. `04. runtime 模块设计.md` — 了解检索编排（重点看四阶段模型和 post-retrieval）
6. `05. observability 模块设计.md` — 了解可观测性设计
7. `06. 验证体系设计.md` — 了解测试要求

### 如果你要开始编码

1. 先阅读 `../STATUS.md` — 了解当前工程状态
2. 阅读 `07. 目录重构计划.md` — 按步骤执行目录重构
3. 按 `STATUS.md` 中的 Phase A → B → C 顺序实施

---

## 关键决策摘要

| 决策 | 内容 |
|------|------|
| 包结构 | 单包多模块，core 扁平化到 `src/` 根目录，子模块为 `indexing/` / `runtime/` / `observability/` |
| 数据校验 | 强制使用 Zod（`src/schema.ts`） |
| 向量库解耦 | 新增 `src/vector-store.ts` 定义 `IVectorStore` 接口，彻底解耦 server |
| Query 抽象 | 新增 `Query` 接口（支持 rewrite / expansion / routing），替代简单字符串 |
| Chunk 增强 | 新增 `parentId`、`hierarchyPath`、`metadata`，支持 Small-to-Big Retrieval |
| 检索结果 | `IRetriever` 返回 `RetrievalCandidate[]`（含 source / route / metadata），替代 `ChunkWithScore[]` |
| 后处理 | 分层处理：filter → rerank → budget trim，支持 `SelectionTrace` 记录每步原因 |
| 可观测性 | 内置 `RAGTracer` + `RAGObserver`，支持 traceId 串联和阶段耗时 breakdown |
| 包引用方向 | `server → rag-sdk` 单向依赖，禁止反向 |
| 测试框架 | Vitest + TypeScript |
| 构建验证 | `pnpm type-check && pnpm test && pnpm build` |

---

## 与原独立多包方案的关系

本目录下的文档基于 `D:\projects\ai-stared-project\rag-sdk-docs\` 中的设计重新整理，主要调整：

- **7 个独立包 → 1 个包 3 个模块**：降低发布和维护成本，core 扁平化
- **删除 adapters**：当前仅 OpenAI 一种适配，直接实现在 `indexing/embedders/`
- **删除 utils**：工具函数直接放在对应模块内
- **新增 observability**：内置可观测性能力，替代独立的 observability 包
- **跨包 npm 引用 → 包内相对路径引用**：简化依赖管理
- **向量存储接口内聚**：从 server 解耦到 SDK 内部
- **Query / RetrievalCandidate 抽象**：支持更丰富的检索策略和调试信息

原设计文档中的知识储备（`rag-sdk-docs/knowledge/`）仍可作为技术参考。
