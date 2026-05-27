# 待办事项

> 自动生成于 2026-05-22

## 进行中

_暂无_

## 待启动

按依赖顺序执行：

1. **b-06-folder-session-settings-testing** — Folder/Session/Settings 测试
2. **b-07-health-and-middleware-testing** — Health + 全局中间件测试
3. **d-11-rag-sdk-core-contracts** — RAG SDK Core 契约层（types / schema / interfaces / errors / pipeline / vector-store）
   - 阻塞性基础 issue，d-12/d-13/d-14 均依赖此 issue
4. **d-12-rag-sdk-indexing-module** — RAG SDK 索引构建模块（chunkers / embedders / indexers / indexing pipeline）
   - 阻塞于：d-11
5. **d-13-rag-sdk-runtime-module** — RAG SDK 在线检索模块（hybrid retriever / postprocessor / runtime pipeline / RRF）
   - 阻塞于：d-11
6. **d-14-rag-sdk-observability** — RAG SDK 可观测性模块（tracer / observer / metrics）
   - 阻塞于：d-11, d-13（依赖 runtime 产生的 SelectionTrace 等 trace 数据）
7. **d-15-rag-sdk-integration** — RAG SDK 集成验证（单元测试 / demo / server 集成点文档）
   - 阻塞于：d-12, d-13, d-14

## 备注

- RAG SDK 系列 issue 编号 d-11 ~ d-15，设计文档位于 `packages/rag-sdk/docs/`
- server 侧实际集成（IVectorStore / IKeywordStore / IGenerator 实现、Worker Handler / ChatService 接入）待 d-15 完成后另行创建 issue
