# 待办事项

> 最后更新：2026-06-07

## 进行中

_暂无_

## ✅ 已完成 — 前端迁移：Vue 3 → React（v3-frontend-migration）

> PRD：[docs/prd/v3-frontend-migration.md](docs/prd/v3-frontend-migration.md)
> 完成日期：2026-06-07 | 状态：**全部 8 个 issue 已实现并构建通过**

| Issue | 优先级 | 状态 | 摘要 |
|-------|--------|------|------|
| [i-32](docs/issues/i-32-web-infra-setup/) | p0 | ✅ done | packages/web 基建搭建（TanStack Start + SPA + Vite + Tailwind v4 + Pencil tokens） |
| [f-33](docs/issues/f-33-auth-flow-migration/) | p0 | ✅ done | 鉴权流程（alova 实例 + Token 刷新队列 + packages/data/ + Zustand auth Store + login/register + beforeLoad 路由守卫） |
| [f-34](docs/issues/f-34-app-shell-overlay/) | p0 | ✅ done | App Shell（Sidebar + TabBar） + Overlay 系统（React Portal + Zustand Store + openDialog/openContextMenu 命令式 API） |
| [f-35](docs/issues/f-35-chatview-migration/) | p0 | ✅ done | ChatView 页面（MessageBubble + react-markdown + ChatInput + EditorPlaceholder + chat Store） |
| [f-36](docs/issues/f-36-kb-page-migration/) | p1 | ✅ done | 知识库页面（kb schemas + api/kb.ts + kb Store + KbListPage） |
| [f-37](docs/issues/f-37-aux-pages-migration/) | p1 | ✅ done | History/Settings/RecycleBin 页面（4 routes + auth logout） |
| [f-38](docs/issues/f-38-ui-library-finalize/) | p2 | ✅ done | Tailwind v4 对齐 + cn() 8 files + packages/data/ 3 domains（auth/chat/kb schemas） |
| [f-39](docs/issues/f-39-test-cleanup/) | p2 | ✅ done | 单元测试 13 passed（auth-store + cn-utility + overlay-store） + 构建通过 |

## 待启动 — 其他

- **f-XX Session 列表分页 UI** — 后端 b-14 已完成 Session 分页 API（`GET /api/sessions?page=&limit=`），当前前端仍一次性全量加载。需实现：分页组件、滚动加载或翻页、空状态处理。当前限制：会话超过 50 条时仅显示前 50 条，无翻页能力。（注：此功能可能在 f-37 中附带解决）

## 技术债务（待处理）

### RAG 检索链路

- **向量检索结果缺少 chunk content，导致语义检索被静默降级** — `packages/rag-sdk/src/runtime/hybrid-retriever.ts:52`
  - 根因：`PgVectorStore.searchVectors()` 的 SQL 仅返回 `id` + `score`，不返回 `content`。`HybridRetriever` 用占位值填充 `content: ''`。
  - 后果：`chat.service.ts:72` 的防御性过滤会将这些向量检索结果丢弃，RAG 实际主要依赖 `KeywordService` 的关键词匹配。
  - 建议：修改 `PgVectorStore.searchVectors` 的 SQL，通过 JOIN 或扩展 SELECT 同时返回 `content`、`document_id`、`kb_id`、`chunk_index` 列。

- **RAG SDK 接口与实现不匹配** — `packages/rag-sdk/src/vector-store.ts`
  - 根因：`VectorSearchResult` 只定义 `chunkId: string`，但 `HybridRetriever.retrieve()` 需要完整 `chunk` 对象（含 content）。
  - 建议：评估将 `VectorSearchResult` 扩展为包含完整 chunk 信息，或明确拆分"轻量检索"与"详情检索"两个接口。

### 架构/设计

- **PrismaService 代理模式可维护性**：手动代理每个模型方法，新增模型时需同步维护。未来可考虑 `Proxy` 自动代理或生成器脚本。

- **packages/data/ 后端 DTO 迁移边界未定义**：PRD §6.6 提到"存量后端暂时不动已有 DTO，新接口强制走共享包"，但未设定后端 DTO 迁移的触发条件。

- **BlockNote 完整集成时机**：f-35 仅放 `EditorPlaceholder` 占位，BlockNote 完整集成需单独 issue。

### 前端性能

- **Session 列表无分页，存在性能隐患** — `packages/webui/src/stores/session.ts:47`
  - 根因：前端调用 `GET /api/sessions` 时不传 `page`/`limit` 参数，依赖后端默认行为。
  - 关联待办：见上方"待启动 — 其他"中的 f-XX Session 列表分页 UI。

### 测试/E2E

- **E2E 测试复杂度累积** — `tests/e2e/pages/ChatPage.ts`
  - 根因：EmptySession/ChatInput 双模式导致测试需要 `ensureChatInputVisible()` 等适配逻辑。
  - 建议：当前状态稳定（75/75 通过），暂不紧急。后续重构聊天页面初始状态时同步简化。
