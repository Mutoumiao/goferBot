---
id: d-01-rag-sdk-contracts
type: issue
status: closed
track: design
priority: p0
summary: 为 RAG SDK 定义接口合约（IChunker/IEmbedder/IRetriever/IIndexer），结束当前空壳状态。Phase 5 实现时只需遵循接口。
blocked_by: []
blocks: []
spec: docs/03-specs/d-01-rag-sdk-contracts/
plan: docs/04-plans/d-01-rag-sdk-contracts/v1.md
tests: docs/08-test-cases/d-01-rag-sdk-contracts/
token_estimate: 800
---

状态: needs-triage
分类: enhancement

## 要构建的内容

为 `packages/rag-sdk/` 定义接口合约。当前该包是空壳（仅 `export {}`），Phase 5 的 RAG 集成需要明确的接口约束来指导实现。

## 规格引用

- PRD: docs/01-prd/v2-cloud-native.md
- ADR: docs/adrs/0004-cloud-native-rearchitecture.md

## 验收标准

- [ ] `packages/rag-sdk/src/interfaces/IChunker.ts` — 文档分块接口（chunk: (doc: Document) => Chunk[]）
- [ ] `packages/rag-sdk/src/interfaces/IEmbedder.ts` — 向量化接口（embed: (texts: string[]) => number[][]）
- [ ] `packages/rag-sdk/src/interfaces/IRetriever.ts` — 检索接口（retrieve: (query, kbIds, topK) => ChunkWithScore[]）
- [ ] `packages/rag-sdk/src/interfaces/IIndexer.ts` — 索引接口（index: (chunks) => void）
- [ ] `packages/rag-sdk/src/interfaces/index.ts` — 统一导出
- [ ] 嵌入维度从配置读取，不硬编码（支持 OpenAI 1536 / bge-large-zh 1024 等）
- [ ] 检索接口支持混合检索参数预留（向量 + 关键词 + RRF）

## 阻塞于

- 无（与 i-00-core-interfaces 并行）

## 范围外

- SDK 具体实现（Phase 5）
- Reranker 接口（Phase 5 后期）

## Agent 简报

**分类：** enhancement
**摘要：** 为 RAG SDK 定义接口合约（IChunker / IEmbedder / IRetriever / IIndexer），结束当前空壳状态

**当前行为：**
`packages/rag-sdk/src/index.ts` 仅包含 `export {}`，无任何类型定义。

**期望行为：**
接口合约定义完成，Phase 5 实现时只需遵循接口。

**关键接口：**
- `packages/rag-sdk/src/interfaces/IChunker.ts`
- `packages/rag-sdk/src/interfaces/IEmbedder.ts`
- `packages/rag-sdk/src/interfaces/IRetriever.ts`
- `packages/rag-sdk/src/interfaces/IIndexer.ts`

**验收标准：**
- [ ] 四个接口定义完成
- [ ] 嵌入维度可配置
- [ ] 混合检索参数预留
- [ ] 统一导出

**范围外：**
- SDK 具体实现
- Reranker 接口
