# 待办事项

> 最后更新：2026-06-07

## 进行中

_暂无_

## 待启动 — 前端迁移：阶段二补全（P0）

> PRD：[docs/prd/v3-frontend-migration.md](docs/prd/v3-frontend-migration.md) §5.6
> 当前迁移率 ~60%（7 closed / 15 total）

| Issue | 优先级 | 阻塞于 | 摘要 |
|-------|--------|--------|------|
| ~~[f-40](docs/issues/f-40-session-store/)~~ | ~~p0~~ | ~~f-33~~ | ✅ closed — Pinia session.ts → Zustand chat store 扩展（会话列表/CRUD） |
| ~~[f-41](docs/issues/f-41-settings-store/)~~ | ~~p0~~ | ~~f-33~~ | ✅ closed — Pinia settings.ts → Zustand（配置持久化 + dirty 追踪） |
| ~~[f-42](docs/issues/f-42-file-store/)~~ | ~~p0~~ | ~~f-33~~ | ✅ closed — Pinia file.ts → Zustand（上传队列 + 并发控制） |
| ~~[f-43](docs/issues/f-43-tabs-store/)~~ | ~~p0~~ | ~~f-33~~ | ✅ closed — Pinia tabs.ts → Zustand（标签页管理 + persist） |

## 待启动 — 前端迁移：阶段三深化（P1）

> PRD：[docs/prd/v3-frontend-migration.md](docs/prd/v3-frontend-migration.md) §5.7

| Issue | 优先级 | 阻塞于 | 摘要 |
|-------|--------|--------|------|
| [f-44](docs/issues/f-44-chat-sse-flow/) | p1 | f-40 | ChatView SSE 流式接收（useSSE + 重连 + 打字机动画） |
| [f-45](docs/issues/f-45-chat-session-mgmt/) | p1 | f-40, f-44 | Chat 会话管理（新建/切换/删除/重命名 + KbSelector） |
| [f-46](docs/issues/f-46-kb-file-upload/) | p1 | f-42 | KB 文件上传（拖拽 + FileManager + FileGridItem + BreadcrumbNav） |
| [f-47](docs/issues/f-47-kb-crud/) | p1 | f-46 | KB CRUD 完整交互（创建/编辑/删除 Dialog + 详情页） |
| [f-48](docs/issues/f-48-settings-form/) | p1 | f-41 | Settings 配置表单（Zod 验证 + 未保存提示 + beforeunload） |
| [f-49](docs/issues/f-49-blocknote-editor/) | p1 | f-44 | BlockNote 富文本编辑器替换纯文本输入 |

## 待启动 — 前端迁移：阶段四+五（P2）

> PRD：[docs/prd/v3-frontend-migration.md](docs/prd/v3-frontend-migration.md) §5.4-§5.5

| Issue | 优先级 | 阻塞于 | 摘要 |
|-------|--------|--------|------|
| [f-38](docs/issues/f-38-ui-library-finalize/) | p2 | P0+P1 完成后 | 84 个 shadcn-vue → shadcn/ui 组件替换 + 样式对齐 |
| [f-39](docs/issues/f-39-test-cleanup/) | p2 | P0+P1 完成后 | 测试迁移（Vue→React）+ E2E 适配 + 删除 packages/webui |

## 待启动 — 其他

- **Session 列表分页 UI** — 后端 b-14 已完成 Session 分页 API，前端需实现分页组件/滚动加载。当前限制：会话超过 50 条时仅显示前 50 条。

## 技术债务

### RAG 检索链路

- **向量检索结果缺少 chunk content，导致语义检索被静默降级** — `packages/rag-sdk/src/runtime/hybrid-retriever.ts:52`
  - 根因：`PgVectorStore.searchVectors()` 的 SQL 仅返回 `id` + `score`，不返回 `content`。`HybridRetriever` 用占位值填充 `content: ''`。
  - 后果：`chat.service.ts:72` 的防御性过滤会将这些向量检索结果丢弃，RAG 实际主要依赖 `KeywordService` 的关键词匹配。
  - 建议：修改 `PgVectorStore.searchVectors` 的 SQL，通过 JOIN 或扩展 SELECT 同时返回 `content`、`document_id`、`kb_id`、`chunk_index` 列。

- **RAG SDK 接口与实现不匹配** — `packages/rag-sdk/src/vector-store.ts`
  - 根因：`VectorSearchResult` 只定义 `chunkId: string`，但 `HybridRetriever.retrieve()` 需要完整 `chunk` 对象（含 content）。
  - 建议：将 `VectorSearchResult` 扩展为包含完整 chunk 信息，或拆分"轻量检索"与"详情检索"两个接口。

### 架构/设计

- **PrismaService 代理模式可维护性**：手动代理每个模型方法，新增模型时需同步维护。未来可考虑 `Proxy` 自动代理或生成器脚本。
- **packages/data/ 后端 DTO 迁移边界未定义**：PRD §6.6 提到"存量后端暂时不动已有 DTO，新接口强制走共享包"，但未设定后端 DTO 迁移的触发条件。
- **BlockNote 完整集成时机**：当前 `EditorPlaceholder` 占位，完整集成见 [f-49](docs/issues/f-49-blocknote-editor/)。

### 前端性能

- **Session 列表无分页，存在性能隐患** — `packages/webui/src/stores/session.ts:47`
  - 根因：前端调用 `GET /api/sessions` 时不传 `page`/`limit` 参数，依赖后端默认行为。

### 测试/E2E

- **E2E 测试复杂度累积** — `tests/e2e/pages/ChatPage.ts`
  - 根因：EmptySession/ChatInput 双模式导致测试需要 `ensureChatInputVisible()` 等适配逻辑。
  - 建议：当前状态稳定（75/75 通过），暂不紧急。后续重构聊天页面初始状态时同步简化。
