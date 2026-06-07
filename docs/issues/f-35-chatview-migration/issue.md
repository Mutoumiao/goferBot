---
id: f-35
status: open
track: frontend
priority: p0
summary: 迁移 ChatView 页面 — chat API（alova useSSE 流式聊天）+ 消息发送/接收/历史记录 + BlockNote 富文本编辑器预留接口，完成后 Chat 功能完整可用
blocked_by:
  - f-34
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/v3-frontend-migration.md
prd_section: §5.3 阶段三 P0 ChatView
---

## 要构建的内容

迁移 GoferBot 最复杂的页面 ChatView：创建 chat API（`api/chat.ts` — 基于 alova `useSSE` 实现 SSE 流式聊天消息接收）、消息列表渲染（用户消息 + AI 回复 + Markdown 渲染）、消息发送（输入框 + 发送按钮）、历史记录加载（滚动分页）、BlockNote 编辑器预留接口（不深入集成，只留 `EditorPlaceholder` 组件标记接入点）。同时将 chat 域 Zod schema 提取到 `packages/data/`。

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md
- API 规格: specs/api-spec.md

## PRD 引用

- **来源 PRD**: docs/prd/v3-frontend-migration.md
- **对应章节**: §5.3 阶段三 P0 ChatView + §6.2 数据获取与 API 管理
- **核心目标**: ChatView 页面完整可用（消息发送、接收、历史记录）；每迁移一个页面同步替换涉及的 shadcn-vue 组件
- **验收标准**: Chat 页面完整可用；alova `useSSE` 正确接收 SSE 流式响应

## 验收标准

- [ ] `api/chat.ts` — `sendMessage()` (POST)、`getHistory()` (GET)、`streamChat()` (SSE) 方法
- [ ] `packages/data/src/schemas/chat.schema.ts` — chat 域 Zod schema + TS 类型导出
- [ ] ChatView 页面布局 — 消息列表区 + 底部输入区
- [ ] 消息列表 — 用户消息（右侧气泡）+ AI 回复（左侧气泡 + Markdown 渲染）
- [ ] SSE 流式聊天 — 使用 alova `useSSE`，消息逐字显示
- [ ] 历史记录 — 滚动到顶加载更早消息（usePagination 或 useWatcher）
- [ ] 消息发送 loading 态 — 发送按钮禁用 + 占位消息"思考中..."
- [ ] error 态 — 网络错误提示 + 重试按钮
- [ ] BlockNote 预留 — `EditorPlaceholder` 组件存在于输入区，标记后续接入位置
- [ ] 参考资源：`docs/reference/alova-react-guide.md` useSSE + usePagination

## 阻塞于

- f-34: App Shell 布局与 Overlay 系统迁移（需要 AuthenticatedLayout + Sidebar + TabBar 就绪）

## 范围外

- 不深入集成 BlockNote（仅预留占位）
- 不迁移 Chat 相关的 Dialog（如 KB 选择器，属于 f-36）
- 不修改后端 Chat API
