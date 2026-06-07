---
id: f-35
issue: issue.md
version: 1
---

# ChatView 页面迁移 实现计划

**目标：** 迁移 ChatView — alova useSSE 流式聊天 + 消息列表 + 历史加载 + BlockNote 预留

**技术栈：** alova `useSSE` + `usePagination` + React Markdown 渲染（react-markdown 或自定义）

**Issue 引用：** [issue.md](./issue.md) | **Spec 引用：** [specs/](./specs/) | **PRD 引用：** §5.3 P0

---

## ADR 合规声明

| ADR | 涉及内容 | 符合 |
|-----|---------|------|
| ADR 0001 | 依赖引入 | ✅ 无新增禁止依赖 |

---

## 任务列表

### 任务 1: 提取 chat Zod schema 到 packages/data/
- [ ] RED → GREEN：创建 `packages/data/src/schemas/chat.schema.ts` + 类型导出

### 任务 2: 创建 api/chat.ts
- [ ] RED → GREEN：`sendMessage()`、`getHistory()`、`streamChat()` 方法

### 任务 3: 实现消息列表组件 + Markdown 渲染
- [ ] RED → GREEN：消息气泡（用户/AI 区分）、Markdown 渲染（`react-markdown`）

### 任务 4: 实现 SSE 流式聊天
- [ ] RED → GREEN：alova `useSSE` hook，逐字追加显示，流结束标记

### 任务 5: 实现历史记录滚动加载
- [ ] RED → GREEN：`usePagination` 或滚动事件 + `useFetcher`

### 任务 6: 实现 ChatView 页面布局 + loading/error 状态
- [ ] RED → GREEN：完整页面布局，三态渲染测试

### 任务 7: 添加 BlockNote 占位组件
- [ ] RED → GREEN：`EditorPlaceholder` 组件
