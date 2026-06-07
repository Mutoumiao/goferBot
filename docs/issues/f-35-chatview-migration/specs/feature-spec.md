# 功能规格：ChatView 页面迁移

> 状态：draft | 关联 issue：f-35 | PRD：§5.3 P0 + §6.2

---

## 1. 目标

迁移 ChatView 页面 — 使用 alova `useSSE` 实现 SSE 流式聊天、消息列表渲染（用户/AI 气泡 + Markdown）、历史记录滚动加载、BlockNote 编辑器预留接口。

---

## 2. 功能描述

### 2.1 Chat API

```typescript
// api/chat.ts
export const sendMessage = (chatId: string, content: string) =>
  alovaInstance.Post('/chat/message', { chatId, content })

export const getHistory = (chatId: string, page: number) =>
  alovaInstance.Get('/chat/history', { params: { chatId, page } })

// SSE 流式（alova useSSE）
export const streamChat = (chatId: string, message: string) =>
  alovaInstance.Get('/chat/stream', {
    params: { chatId, message },
    enableSSE: true,  // alova v3 SSE 支持
  })
```

### 2.2 消息列表

| 消息类型 | 对齐 | 气泡样式 |
|----------|------|----------|
| 用户消息 | 右侧 | 蓝色背景 |
| AI 回复 | 左侧 | 灰色背景 + Markdown 渲染 |
| 系统消息 | 居中 | 灰色小字 |

### 2.3 SSE 流式聊天

- 使用 alova `useSSE` hook
- 消息逐 token 追加显示
- 流结束时标记 `isComplete: true`

### 2.4 BlockNote 预留

- `EditorPlaceholder` 组件 — 渲染一个带边框的 `div`，内文本"BlockNote 编辑器（Phase 2 接入）"
- 位置：消息输入区上方
- 不引入 BlockNote 依赖

### 2.5 packages/data/ chat schema

```typescript
// packages/data/src/schemas/chat.schema.ts
export const sendMessageSchema = z.object({
  chatId: z.string(),
  content: z.string().min(1),
})

export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  createdAt: z.string(),
})
```

---

## 3. 验收标准

| AC | 验收项 |
|----|--------|
| AC-01 | api/chat.ts 方法完整 |
| AC-02 | packages/data chat Zod schema 已提取 |
| AC-03 | ChatView 页面布局（消息列表 + 输入区） |
| AC-04 | 消息气泡渲染（用户/AI + Markdown） |
| AC-05 | SSE 流式聊天逐字显示 |
| AC-06 | 历史记录滚动加载 |
| AC-07 | loading/error/重试 三态完整 |
| AC-08 | BlockNote EditorPlaceholder 占位 |
