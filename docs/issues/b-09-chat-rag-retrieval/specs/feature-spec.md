# 功能规格：对话 RAG 检索接入

## 用户故事

作为已登录用户，我希望在对话时指定一个或多个知识库，以便 AI 回答基于我上传的文档内容而非仅依赖模型训练知识。

作为已登录用户，我希望在未指定知识库时对话行为与现有完全一致，以便不增加认知负担。

## 边界

- 范围内：
  - `ChatService.streamChat()` 在 `knowledgeBaseIds` 存在时执行 RAG 检索
  - `HybridRetriever.retrieve()` 获取候选 chunks
  - `DefaultRetrievalPostprocessor.process()` 过滤排序
  - 将筛选后的 chunks 拼接为 context 注入 system message
  - `ChatDto` 扩展 `knowledgeBaseIds` 字段（Zod Schema）
  - 检索失败或检索无结果时正常调用 LLM，不阻断对话
  - 不传入 `knowledgeBaseIds` 时行为无回归

- 范围外：
  - 前端知识库选择器 UI（由 `f-16-chat-kb-selector` 负责）
  - 索引流水线触发（由 `b-10-server-vector-keyword-adapters` 及后续 issue 负责）
  - `runRetrievalPipeline` 的使用（SDK 非流式，与 SSE 冲突）
  - 消息表 metadata 字段扩展（可选 Phase 2，不在本 issue）
  - 重排序器（reranker）接入（`DefaultRetrievalPostprocessor` 支持但本 issue 不配置）

## 涉及页面/组件

- `packages/server/src/modules/chat/chat.service.ts`
- `packages/server/src/modules/chat/dto/chat.dto.ts`
- `packages/server/src/modules/chat/chat.module.ts`

## 相关功能

- `b-10-server-vector-keyword-adapters` — 提供 `VectorService`（`IVectorStore`）和 `KeywordService`（`IKeywordStore`），构建 `HybridRetriever` 的前置依赖
- `f-16-chat-kb-selector` — 前端消费 `knowledgeBaseIds` 字段，本 issue 为其提供后端 API 支持
- `q-21-rag-server-integration-e2e` — E2E 测试依赖本 issue 的对话检索功能可用

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 不走 `runRetrievalPipeline`，手动编排 retrieve + postprocess | SDK 流水线返回完整字符串（非流式），与现有 SSE 流式输出冲突 | 是，SDK 未来支持流式生成后可替换 |
| `DefaultRetrievalPostprocessor` 使用默认配置（minScore=0, maxChunks=10, tokenBudget=3000） | 不过滤低分结果（minScore=0），保留足够上下文（10 chunks / 3000 tokens），MVP 阶段无需调参 | 是，后续可通过配置服务注入 |
| 检索失败时静默降级为纯向量检索或跳过检索 | 对话体验优先，不因检索故障阻断用户 | 是，后续可改为返回错误提示 |
| chunks 拼接分隔符为 `\n---\n` | 清晰分隔不同文档来源，便于模型区分 | 是 |
