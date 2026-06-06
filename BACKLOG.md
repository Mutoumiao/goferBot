# 待办事项

> 自动生成于 2026-05-22，最后更新于 2026-06-05

## 进行中

_暂无_

## 待启动

- **f-XX Session 列表分页 UI** — 后端 b-14 已完成 Session 分页 API（`GET /api/sessions?page=&limit=`），当前前端仍一次性全量加载。需实现：分页组件、滚动加载或翻页、空状态处理。当前限制：会话超过 50 条时仅显示前 50 条，无翻页能力。

## 技术债务

### 测试架构治理（2026-06-05 创建）

- **q-24 单元测试数据库隔离治理** — `docs/issues/q-24-unit-test-db-isolation/`
  - 修复单元测试直接连接真实数据库的问题，强制 Mock 模式
  - 阻断开发库污染，清理残留测试数据
  - 状态：closed，2026-06-05 完成

- **q-25 集成测试数据库隔离统一化** — `docs/issues/q-25-integration-test-db-unify/`
  - 统一所有集成测试使用 `TestDatabaseManager` 独立数据库
  - 消除直接连接 `goferbot_test` 共享库的违规测试
  - 状态：closed，2026-06-06 完成

- **q-26 E2E 测试数据库清理机制** — `docs/issues/q-26-e2e-db-cleanup/`
  - 为 E2E 测试建立数据库清理机制，防止 `goferbot_e2e` 数据无限累积
  - 改造 `playwright.global-teardown.ts` 和 `fixtures/auth.ts`
  - 状态：closed，2026-06-06 完成

- **q-27 后端测试覆盖率门槛定义与核心模块测试补齐** — `docs/issues/q-27-backend-coverage-threshold/`
  - 定义后端单元测试覆盖率门槛（渐进式实施）
  - 为 AuthModule、KnowledgeBaseModule 建立单元测试骨架
  - 状态：open，阻塞已解除

### 架构/设计

- **PrismaService 代理模式可维护性**：手动代理每个模型方法，新增模型时需同步维护。未来可考虑 `Proxy` 自动代理或生成器脚本。

### RAG 检索链路（2026-06-05 洞察挖掘发现）

- **向量检索结果缺少 chunk content，导致语义检索被静默降级** — `packages/rag-sdk/src/runtime/hybrid-retriever.ts:52`
  - 根因：`PgVectorStore.searchVectors()` 的 SQL 仅返回 `id` + `score`，不返回 `content`。`HybridRetriever` 用占位值填充 `content: ''`。
  - 后果：`chat.service.ts:72` 的防御性过滤会将这些向量检索结果丢弃，RAG 实际主要依赖 `KeywordService` 的关键词匹配，语义检索优势被浪费。
  - 建议：修改 `PgVectorStore.searchVectors` 的 SQL，通过 JOIN 或扩展 SELECT 同时返回 `content`、`document_id`、`kb_id`、`chunk_index` 列，使 `HybridRetriever` 能获得完整 chunk 信息。
  - 影响范围：Chat RAG 回答质量（尤其需要语义理解的查询）。

- **RAG SDK 接口与实现不匹配** — `packages/rag-sdk/src/vector-store.ts`
  - 根因：`VectorSearchResult` 只定义 `chunkId: string`，但 `HybridRetriever.retrieve()` 需要完整 `chunk` 对象（含 content）。
  - 后果：接口契约与实际需求脱节，迫使实现方（`PgVectorStore`）在 SQL 中做额外查询，或调用方（`HybridRetriever`）使用占位值。
  - 建议：评估是否将 `VectorSearchResult` 扩展为包含完整 chunk 信息，或明确拆分"轻量检索"与"详情检索"两个接口。

### 前端性能

- **Session 列表无分页，存在性能隐患** — `packages/webui/src/stores/session.ts:47`
  - 根因：前端调用 `GET /api/sessions` 时不传 `page`/`limit` 参数，依赖后端默认行为。
  - 后果：若后端默认返回全部会话，用户会话数增长时前端一次性加载全部数据，渲染性能和内存占用线性下降。
  - 建议：确认后端默认分页策略；若默认无限制，前端应立即添加默认 `limit` 参数（如 `?limit=50`）作为短期防护，同时推进分页 UI 实现。
  - 关联待办：见上方"待启动"中的 f-XX Session 列表分页 UI。

### 测试/E2E

- **E2E 测试复杂度累积** — `tests/e2e/pages/ChatPage.ts`
  - 根因：EmptySession/ChatInput 双模式导致测试需要 `ensureChatInputVisible()` 等适配逻辑。
  - 后果：E2E 测试维护成本高于理想状态，新增测试需理解双模式切换逻辑。
  - 建议：当前状态稳定（75/75 通过），暂不紧急处理。后续若重构聊天页面初始状态，同步简化测试逻辑。

## 已修复（2026-06-04）

- ✅ **验证管道统一**：Admin 模块 DTO 已从 `class-validator` 迁移至 `ZodValidationPipe`，移除 `class-validator` + `class-transformer` 依赖
- ✅ **Admin API 响应格式统一**：移除 `@BypassResponse()`，所有 Admin API 统一走 `ResponseInterceptor` 包装为 `{ data: ... }` 格式

## 备注

- RAG SDK 系列 issue（d-11 ~ d-15）已全部关闭
- RAG Server 集成 issue（d-20 / b-10 / b-11 / b-08 / b-09 / f-16 / q-21 / q-22）已于 2026-05-29 完成开发
- q-21 E2E 测试骨架已完成，真实链路验证由 q-22 覆盖
- q-22 RAG 真实集成测试已完成（AC-01~AC-07 全部 passed），基础设施不可用时优雅跳过
- **2026-06-01 重建计划**：
  - ✅ i-02 Docker + Prisma Schema 更新（已关闭）
  - ✅ b-12 PgVectorStore + VectorService 切换（已关闭）
  - ✅ b-13 PrismaVectorIndexer 重写（已关闭）
  - ✅ q-23 集成测试层修复（已关闭）
  - ✅ q-17-rev 真实 API 版本（已关闭）
  - ✅ i-03 Milvus 代码清理（已关闭）
