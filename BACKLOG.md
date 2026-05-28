# 待办事项

> 自动生成于 2026-05-22，最后更新于 2026-05-28

## 进行中

1. **q-16-e2e-infra-migration** — E2E 测试基础设施重构（删除 Tauri，建立真实 API Web E2E）
   - 已有提交：infra 测试、globalSetup/globalTeardown、fixtures（auth/api-client/database）
2. **q-17-e2e-auth-kb-specs** — E2E 认证流程与知识库生命周期测试
   - 阻塞于：q-16
   - 已有提交：AuthPage POM、01-auth-flow.spec.ts、02-kb-lifecycle.spec.ts
3. **q-18-e2e-chat-session-specs** — E2E 聊天 SSE 与会话管理测试
   - 阻塞于：q-16
   - 已有提交：03-chat-with-rag.spec.ts、04-session-management.spec.ts

## 待启动

按依赖顺序执行：

### E2E 测试

4. **q-19-e2e-settings-journey** — E2E 设置持久化与跨模块用户旅程测试
   - 阻塞于：q-16, q-17

### RAG Server 集成（依赖：d-15 已关闭）

5. **d-20-rag-sdk-embedder-token-usage** — SDK Embedder 接口扩展（embedWithUsage + TokenUsage）
   - spec/plan 已就绪
6. **b-10-server-vector-keyword-adapters** — Server 向量与关键词存储适配（SDK IVectorStore + IKeywordStore 实现）
   - spec/plan 已就绪
7. **b-11-document-parser-indexer** — 文档解析与索引写入（DocumentParser + PrismaMilvusIndexer）
   - 阻塞于：d-20, b-10
   - spec/plan 已就绪
8. **b-08-indexing-worker-integration** — 索引 Worker 与队列集成（IndexingWorker + QueueModule + DocumentService 触发）
   - 阻塞于：b-11
   - spec/plan 已就绪
9. **b-09-chat-rag-retrieval** — 对话 RAG 检索接入（ChatService 检索上下文注入）
   - 阻塞于：b-10
   - spec/plan 已就绪
10. **f-16-chat-kb-selector** — 前端对话知识库选择器（Chat 页面 KB 关联）
    - 阻塞于：b-09
    - spec/plan 已就绪
11. **q-21-rag-server-integration-e2e** — RAG Server 集成端到端验证（上传→索引→对话检索完整链路）
    - 阻塞于：b-08, b-09, f-16
    - spec/plan 已就绪

## 备注

- RAG SDK 系列 issue 编号 d-11 ~ d-15 已全部关闭，设计文档位于 `packages/rag-sdk/docs/`
- server 侧 RAG 集成 issue（d-20 / b-10 / b-11 / b-08 / b-09 / f-16 / q-21）已创建，spec 和 plan 已提交
