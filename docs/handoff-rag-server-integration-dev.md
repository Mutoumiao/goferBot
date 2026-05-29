# Handoff: RAG Server 集成开发（2026-05-29）

## 会话概要

基于 PRD `docs/prd/rag-server-integration.md`，完成了 7 个 RAG server 集成 issue 的 spec、plan 审查和全部代码实现。67 个测试全部通过，类型检查通过。

## 完成的 Issue（全部已提交）

| Issue | 内容 | 测试数 |
|-------|------|--------|
| d-20 | SDK Embedder TokenUsage 扩展 | 19 |
| b-10 | Server 向量与关键词存储适配 | 9 |
| b-11 | 文档解析与索引写入 | 11 |
| b-09 | Chat RAG 检索接入 | 8 |
| b-08 | 索引 Worker 与队列集成 | 8 |
| f-16 | 前端 Chat KB 选择器 | 12 |
| q-21 | RAG Server E2E 测试骨架 | 4 |

## 关键架构决策（已在 spec/plan 中记录）

1. **chunk.id 作为共享主键**：PrismaMilvusIndexer 使用 `chunk.id` 同时作为 PG Chunk 主键和 Milvus VectorRecord.id，消除 milvusId 回写事务
2. **SSE 流式冲突解决**：ChatService 手动编排 `retrieve()` + `process()`，不调用 `runRetrievalPipeline`（该函数返回 Promise<string> 与 SSE 不兼容）
3. **Token 计数优先级**：`usage` 参数 > `chunk.tokenCount` > `content.length / 4` 估算
4. **zhparser 降级**：KeywordService.onModuleInit 检测 pg_extension，未安装降级为 `simple` config
5. **ChatService 降级**：RAG 检索失败时自动降级为普通 LLM 调用

## 当前代码结构

### SDK（packages/rag-sdk）
- 所有源码位于 `packages/rag-sdk/src/`
- 编译产物（`.js`/`.d.ts`/`.map`）由 `.gitignore` 排除
- Server 通过 `workspace:*` 依赖链接

### Server（packages/server）
- 新增处理器：`processors/parser/`、`processors/indexing/`、`processors/keyword/`、`processors/queue/indexing.worker.ts`
- 原有修改：`VectorService` 适配 SDK 接口、`ChatService` 注入检索、`DocumentService` 触发 job
- 已删除 `interfaces/IVectorStore.ts`（冗余）

### 前端（packages/webui）
- `KbSelector.vue`：新增 error 状态与重试按钮
- `ChatInput.vue`：常驻知识库按钮 + 会话级选中状态
- `ChatView.vue`：`:key` 绑定自动重置选中状态

## 测试运行方式

```bash
# 后端集成测试（需要真实数据库等基础设施）
npx vitest run tests/issues/d-20-rag-sdk-embedder-token-usage/ \
  tests/issues/b-10-server-vector-keyword-adapters/ \
  tests/issues/b-11-document-parser-indexer/ \
  tests/issues/b-09-chat-rag-retrieval/ \
  tests/issues/b-08-indexing-worker-integration/ \
  --config vitest.integration.config.ts

# 前端组件测试
npx vitest run tests/issues/f-16-chat-kb-selector/ --config vitest.config.ts

# 类型检查
pnpm type-check
```

## 待完成项

1. **PDF 解析**：`DocumentParser.parse()` 对 `application/pdf` 抛出 "not yet implemented"
2. **q-21 E2E 真实运行**：测试骨架已创建（`tests/issues/q-21-rag-server-integration-e2e/`），需要 Docker 基础设施就绪后执行验证
3. **IGenerator 接口**：SDK 定义但 server 未实现（手动编排方案已替代）

## BACKLOG / CHANGELOG 状态

- `BACKLOG.md`：RAG server 集成 issue 已全部移除，q-19 移至"进行中"
- `CHANGELOG.md`：2026-05-29 条目记录全部 closed issue

## Suggested Skills

- `/kb-review` — 对新修改进行审查
- `/dev-orchestrator` — 继续开发其他 issue
- `/issue-lifecycle` — 更新 issue 状态
