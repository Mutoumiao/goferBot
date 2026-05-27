# 待办事项

> 自动生成于 2026-05-22

## 进行中

_暂无_

## 进行中

_暂无_

## 待启动

按依赖顺序执行：

1. **q-16-e2e-infra-migration** — E2E 测试基础设施重构（删除 Tauri，建立真实 API Web E2E）
2. **q-17-e2e-auth-kb-specs** — E2E 认证流程与知识库生命周期测试
   - 阻塞于：q-16
3. **q-18-e2e-chat-session-specs** — E2E 聊天 SSE 与会话管理测试
   - 阻塞于：q-16
4. **q-19-e2e-settings-journey** — E2E 设置持久化与跨模块用户旅程测试
   - 阻塞于：q-16, q-17
5. **d-12-rag-sdk-indexing-module** — RAG SDK 索引构建模块（chunkers / embedders / indexers / indexing pipeline）
   - 阻塞于：d-11
6. **d-13-rag-sdk-runtime-module** — RAG SDK 在线检索模块（hybrid retriever / postprocessor / runtime pipeline / RRF）
   - 阻塞于：d-11
7. **d-14-rag-sdk-observability** — RAG SDK 可观测性模块（tracer / observer / metrics）
   - 阻塞于：d-11, d-13（依赖 runtime 产生的 SelectionTrace 等 trace 数据）
8. **d-15-rag-sdk-integration** — RAG SDK 集成验证（单元测试 / demo / server 集成点文档）
   - 阻塞于：d-12, d-13, d-14

## 备注

- RAG SDK 系列 issue 编号 d-11 ~ d-15，设计文档位于 `packages/rag-sdk/docs/`
- server 侧实际集成（IVectorStore / IKeywordStore / IGenerator 实现、Worker Handler / ChatService 接入）待 d-15 完成后另行创建 issue
