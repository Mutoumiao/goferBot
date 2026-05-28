---
id: d-20
status: open
track: design
priority: p1
summary: SDK Embedder 接口扩展（embedWithUsage + TokenUsage）
blocked_by: []
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

扩展 `@goferbot/rag-sdk` 的 `IEmbedder` 接口，使其能够返回精确的 token 用量信息，供下游 `IIndexer` 写入数据库时使用。

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

### 为什么需要这个变更

当前 `IEmbedder.embed()` 只返回向量数组，调用方无法获知每个输入文本消耗的 token 数。这导致：

1. `DefaultRetrievalPostprocessor` 的 token 预算过滤依赖估算（`content.length / 4`），中文场景误差大
2. 未来计费、审计、限流都需要准确的 token 用量
3. Embedding API 已经计算过 token，信息被浪费

### 依赖关系

**阻塞下游：**
- `b-07-document-parser-indexer` — `PrismaMilvusIndexer` 需要 `TokenUsage` 来写入精确的 `tokenCount`

**被阻塞于：**
- 无（本 issue 是 SDK 侧独立变更，不依赖 server 代码）

### 技术要点

- `embedWithUsage()` 返回 `{ vectors: number[][]; usage: TokenUsage[] }`
- `OpenAIEmbedder` 解析 API 响应中的 `usage.prompt_tokens`，按文本长度比例分配到各 chunk
- `runIndexing` 的 embed stage 调用 `embedWithUsage()`，将 usage 传入 indexer
- 保持 `embed()` 方法不变，确保向后兼容
