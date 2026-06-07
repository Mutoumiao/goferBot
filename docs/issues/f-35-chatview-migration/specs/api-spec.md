# API 规格：ChatView 页面迁移

> 状态：draft | 关联 issue：f-35

---

## 1. 涉及的 API 端点

### POST /api/chat/message
- 请求：`{ chatId: string, content: string }`
- 响应：`{ data: { messageId: string, ... } }`

### GET /api/chat/history
- Query：`chatId`, `page`, `pageSize`
- 响应：`{ data: { messages: ChatMessage[], total: number } }`

### GET /api/chat/stream（SSE）
- Query：`chatId`, `message`
- 响应：SSE 事件流 `data: {"token": "..."}\n\n`
- alova 方式：`useSSE` hook

---

## 2. 前端类型

```typescript
// packages/data/src/types/index.ts
export type ChatMessage = z.infer<typeof chatMessageSchema>
export type SendMessageRequest = z.infer<typeof sendMessageSchema>
```
