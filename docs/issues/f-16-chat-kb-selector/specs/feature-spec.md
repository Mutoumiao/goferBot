# 功能规格：聊天知识库选择器

## 用户故事

作为已登录用户，我希望在聊天输入区选择多个知识库，以便让 AI 在回答时基于指定知识库的文档内容进行检索增强。

作为已登录用户，我希望在未选择任何知识库时对话行为与现有完全一致，以便不干扰常规问答体验。

## 边界

- **范围内**：
  - 聊天输入区（`ChatInput.vue`）的知识库多选交互
  - `EmptySession.vue` 输入区的知识库选择入口（UI 占位，同一会话级状态）
  - 选中的 `knowledgeBaseIds` 随 `ChatRequest` 发送到后端
  - 选中状态在**当前活跃会话**生命周期内保持
  - 使用 `shadcn-vue` 标准组件（`Checkbox` 来自 `DropdownMenuCheckboxItem` 或原生 checkbox）

- **范围外**：
  - 后端 RAG 检索逻辑（由 `b-09-chat-rag-retrieval` 负责）
  - 知识库 CRUD 管理（由 `b-02-knowledge-base-crud-api` 负责）
  - 将选中状态持久化到数据库或 localStorage（当前为内存级会话状态）
  - 全局默认知识库设置
  - 知识库权限细粒度控制（沿用现有知识库列表 API 的权限过滤）

## 涉及页面/组件

- `packages/webui/src/views/ChatView.vue` — 会话容器，注入 `kbStore` 数据
- `packages/webui/src/components/ChatInput.vue` — 输入区，承载选择器与选中 pills
- `packages/webui/src/components/chat/KbSelector.vue` — 下拉选择器浮层（多选 checkbox 列表）
- `packages/webui/src/components/KbMentionPill.vue` — 已选知识库标签
- `packages/webui/src/components/EmptySession.vue` — 空会话页输入区（知识库按钮为 UI 占位，点击后进入有会话状态的 `ChatInput`）
- `packages/webui/src/stores/session.ts` — `sendMessage` 已接收 `knowledgeBaseIds` 参数
- `packages/webui/src/stores/knowledgeBase.ts` — 提供知识库列表数据

## 相关功能

- **上游**：`b-02-knowledge-base-crud-api` — 提供 `GET /api/knowledge-bases` 列表数据
- **上游**：`b-09-chat-rag-retrieval` — 后端 `ChatDto` 已声明 `knowledgeBaseIds?: string[]`，`ChatService` 消费该字段进行 RAG 检索
- **下游**：`q-21-rag-server-integration-e2e` — E2E 测试依赖本选择器完成完整用户旅程

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 选中状态保存在组件本地（`ChatInput.vue` 的 `selectedKbs`），非 Pinia store | 最小改动，会话切换时由 `ChatView` 通过 `key` 或显式清空重建；若后续需求要求跨会话保持，再升级为 store | 是 |
| 空选时前端不发送 `knowledgeBaseIds` 字段 | 与后端 `ChatSchema` 的 `.optional()` 对齐，确保无回归 | 否（契约已定） |
| 使用现有 `KbSelector.vue` + `KbMentionPill.vue` 改造，非新增 shadcn 组件 | 代码已存在 `@` 触发下拉选择器，只需扩展为常驻入口 + 多选持久化 | 是 |
| `EmptySession.vue` 的知识库按钮为纯 UI 占位，点击后创建会话并进入 `ChatInput` | 空会话无 `sessionId`，无法发送请求；保持现有流程：先输入内容创建会话，再在选择器中选 KB | 是 |
| 知识库列表错误不阻塞聊天发送 | 选择器加载失败时，用户仍可进行普通对话，降低耦合 | 否 |
