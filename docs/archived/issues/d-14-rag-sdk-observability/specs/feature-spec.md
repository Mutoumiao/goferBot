# 功能规格：RAG SDK 可观测性模块

## 用户故事
作为 SDK 使用者，我希望在索引和检索流水线执行过程中自动收集阶段耗时、中间结果和错误信息，以便调试和性能分析。

## 边界

- 范围内：
  - RAGTrace / RAGStage / RAGObserver 类型定义
  - RAGTracer 生命周期管理（start / stage / complete / error）
  - consoleObserver 默认实现
  - observability/index.ts 统一导出
- 范围外：
  - 外部 APM 集成（OpenTelemetry、Datadog 等）
  - 持久化存储（日志文件、数据库）
  - UI 可视化

## 涉及模块

- `packages/rag-sdk/src/observability/types.ts`
- `packages/rag-sdk/src/observability/tracer.ts`
- `packages/rag-sdk/src/observability/console-observer.ts`
- `packages/rag-sdk/src/observability/index.ts`

## 相关功能

- 上游：d-11 core 契约层 — 提供 RuntimeStage / RuntimeDebugInfo / SelectionTrace
- 上游：d-13 runtime 模块 — 产生 SelectionTrace 等 trace 数据
- 下游：d-15 集成验证 — 消费可观测性数据进行端到端测试

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 不依赖外部 APM | 保持 SDK 轻量化 | 是 |
| consoleObserver 作为默认 | 零配置即可使用 | 是 |
| Tracer 与 Pipeline 解耦 | 通过可选参数注入，不强制使用 | 是 |
