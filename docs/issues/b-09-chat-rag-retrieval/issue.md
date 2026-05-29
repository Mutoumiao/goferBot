---
id: b-09
status: closed
track: backend
priority: p1
summary: 对话 RAG 检索接入（ChatService 检索上下文注入）
blocked_by:
  - b-10
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

在 `ChatService.streamChat()` 中接入 RAG 检索：
1. 当 `dto.knowledgeBaseIds` 存在时，调用 `HybridRetriever` 检索相关 chunks
2. 经 `DefaultRetrievalPostprocessor` 过滤后，将 chunks 内容注入 system message
3. 扩展 `ChatDto`（Zod Schema）支持 `knowledgeBaseIds` 字段

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

### 为什么不走 runRetrievalPipeline

SDK `runRetrievalPipeline` 返回完整字符串（非流式），与现有 SSE 流式输出冲突。改为手动编排：
- `HybridRetriever.retrieve()` 获取候选 chunks
- `DefaultRetrievalPostprocessor.process()` 过滤排序
- 将筛选后的 chunks 拼接为 context，注入 SSE 流式调用

### 依赖关系

**阻塞下游：**
- `f-16-chat-kb-selector` — 前端需要后端 API 支持 `knowledgeBaseIds` 才能开发选择器
- `q-21-rag-server-integration-e2e` — E2E 测试需要对话检索功能可用

**被阻塞于：**
- `b-10-server-vector-keyword-adapters` — 需要 `VectorService`（IVectorStore）+ `KeywordService`（IKeywordStore）构建 `HybridRetriever`

### 技术要点

- 不传入 `knowledgeBaseIds` 时，对话行为与现有完全一致（无回归）
- 检索无结果时，正常调用 LLM（无 system context）
- `HybridRetriever` 需注入 `OpenAIEmbedder` 实例用于查询向量化
- `DefaultRetrievalPostprocessor` 使用默认配置（minScore=0, maxChunks=10, tokenBudget=3000）
