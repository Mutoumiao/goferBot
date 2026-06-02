# 功能规格：d-15 RAG SDK 集成验证

## 用户故事

作为 GoferBot 后端开发者，我希望验证 RAG SDK 的完整端到端链路可用，并获得清晰的 server 集成指南，以便在 NestJS 服务中正确接入 SDK。

## 边界

- **范围内**：
  - 最小可运行 demo：DocumentSource → chunk → embed → index → Query → retrieve → postprocess → context
  - server 集成点文档：IVectorStore / IKeywordStore / IGenerator 实现指南
  - 单元测试覆盖率补全（核心逻辑 ≥ 80%）
  - pnpm test / pnpm build 验证
- **范围外**：
  - server 代码实际修改（仅输出文档，不修改 server 源码）
  - 前端 UI 集成
  - 外部 APM / 可观测性系统对接
  - 性能基准测试（负载测试）

## 涉及模块

- `packages/rag-sdk/src/index.ts` — 统一导出入口
- `packages/rag-sdk/src/indexing/` — 索引构建模块
- `packages/rag-sdk/src/runtime/` — 在线检索模块
- `packages/rag-sdk/src/observability/` — 可观测性模块
- `tests/issues/d-15-rag-sdk-integration/` — 集成验证测试
- `packages/rag-sdk/docs/integration.md` — server 集成点文档

## 相关功能

- **上游**：
  - d-11（core 契约层）— 提供类型、接口、错误体系
  - d-12（索引构建模块）— 提供 chunker / embedder / indexer / runIndexing
  - d-13（在线检索模块）— 提供 retriever / postprocessor / runRetrievalPipeline
  - d-14（可观测性模块）— 提供 RAGTracer / consoleObserver
- **下游**：
  - server BullMQ Worker — 将实现 IVectorStore / IKeywordStore / IGenerator 并注入 SDK
  - server ChatService — 将调用 runRetrievalPipeline 进行问答检索

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| demo 使用内存 Mock 实现所有接口 | 不依赖外部服务（Milvus / OpenAI / PostgreSQL），确保任何环境可运行 | 是 |
| 覆盖率统计使用 vitest 内置 coverage | 无需额外工具，与现有测试基础设施一致 | 否 |
| 集成文档以 Markdown 形式输出到 rag-sdk/docs/ | 与 SDK 代码同仓库，方便版本同步 | 否 |
