Status: needs-triage

## What to build

实现端到端的基础问答对话功能（直连 LLM，暂不涉及 RAG）。用户可以在首页输入问题，AI 通过 SSE 流式返回答复，消息渲染支持 Markdown 和代码高亮。

端到端行为：用户看到"首页"占位符标签（中间大输入框 + 3-4 个快捷提问胶囊）→ 输入问题并发送 → 前端通过 `sidecarClient` 发送 `POST /chat`（SSE）到 sidecar → sidecar 直接调用已配置的 LLM API（OpenAI/DeepSeek 等）→ SSE 流式返回 → 前端逐字渲染 AI 消息（靠左，Markdown + 语法高亮 + 复制按钮）→ 用户消息和 AI 消息存入 SQLite `sessions` 和 `messages` 表 → 首页占位符自动升格为真实会话（标题取用户输入前 N 字或 AI 摘要），同时系统创建新的"首页"占位符标签 → 用户可新建标签、切换标签、关闭标签（1:1 session-tab）。

## Acceptance criteria

- [ ] SQLite Schema：`sessions` 表（`id`, `title`, `provider`, `model`, `created_at`, `updated_at`, `message_count`）和 `messages` 表（`id`, `session_id`, `role`, `content`, `created_at`）
- [ ] Sidecar `POST /chat` API：接收 `{ message, sessionId, knowledgeBaseIds?, config }`，返回 SSE 流（`data: { content }` 格式）
- [ ] Sidecar `GET /sessions` 和 `GET /sessions/:id` API
- [ ] 前端空会话态：中间大输入框 + 发送按钮 + 快捷提问胶囊（固定文案）
- [ ] 前端对话态：底部固定输入框（Enter 发送，Shift+Enter 换行）+ 上部可滚动消息流
- [ ] 消息流：用户消息靠右浅色背景，AI 消息靠左白色背景
- [ ] Markdown 渲染 + 代码语法高亮 + 复制按钮
- [ ] Pinia store：`useSessionStore` 管理当前会话、消息列表、发送状态
- [ ] 首页占位符语义：始终保留，首次发送消息后自动升格为真实会话，同时创建新的首页占位符
- [ ] 顶部标签栏：浏览器式横向滚动，新建/切换/关闭，"首页"无法关闭
- [ ] 单例页面标签（知识库管理、设置、对话历史）只能开一个

## Blocked by

- [01-sidecar-startup](../01-sidecar-startup.md) — 必须先完成 sidecar 启动与前端就绪机制

## Comments
