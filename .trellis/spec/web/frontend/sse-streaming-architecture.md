# SSE 流式架构

> Web 端 SSE（Server-Sent Events）双轨流式架构指南。

---

## 概述

项目采用两种完全不同的 SSE 客户端方案，分别服务于 Chat 和 Companion 两种对话场景：

| 维度 | Chat | Companion |
|------|------|-----------|
| **SSE 库** | `@ant-design/x-sdk` `XRequest` | 原生 `fetch` + `ReadableStream` |
| **抽象层级** | 高层（Provider + useXChat） | 底层（手动解析 SSE 帧） |
| **渲染引擎** | `@ant-design/x-markdown` streaming | 打字机 `CompanionTypingIndicator` |
| **状态管理** | `useXChat` + Zustand 双层 | Zustand `useCompanionStore` |
| **适用场景** | Markdown、代码块、表格 | 纯文本逐字输出（模拟真人） |

---

## Chat SSE 管道（高层抽象）

### 完整数据流

```
XRequest (manual: true)
  → authedFetch (Authorization header)
    → POST /api/chat-messages (SSE)
      → GoferChatProvider.transformMessage (增量累积)
        → useXChat (6 状态生命周期)
          → ChatSessionView (Bubble.List)
            → XMarkdown streaming.hasNextChunk (光标动画)
```

### XRequest + authedFetch

```typescript
// packages/web/src/api/x-chat.ts
import { XRequest } from '@ant-design/x-sdk'

// 自定义 fetch 包装：注入 Authorization header
const authedFetch = (...args: Parameters<typeof fetch>) => {
  const token = useAuthStore.getState().token
  return fetch(args[0], {
    ...(typeof args[1] === 'object' ? args[1] : {}),
    headers: {
      ...(typeof args[1] === 'object' ? (args[1] as RequestInit).headers : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
  })
}

export const xChatRequest = XRequest({
  baseURL: config.VITE_API_BASE_URL,
  fetch: authedFetch,
  manual: true,  // 手动控制发送时机
})
```

### GoferChatProvider — 增量累积

`AbstractChatProvider` 子类，核心逻辑在 `transformMessage`：

```typescript
// packages/web/src/features/chat/providers/GoferChatProvider.ts
transformMessage(info) {
  const { originMessage, chunk } = info
  const { answer } = chunk  // chunk 来自后端 SSE data

  // 增量累积模式：逐块拼接内容
  return {
    ...originMessage,
    content: (originMessage?.content || '') + answer,
  }
}
```

- 如果 `chunk` JSON 解析失败，**静默忽略**，返回当前 `originMessage.content`
- 不允许抛出异常中断流式渲染

### useXChat 6 状态生命周期

| 状态 | 含义 | 触发条件 |
|------|------|----------|
| `loading` | 正在请求/流式中 | `onRequest` 开始 |
| `success` | 流式完成 | `done` 事件 |
| `error` | 请求失败 | 网络错误 / 非正常中断 |
| `local` | 本地消息（用户输入） | `onRequest` 中的 local message |
| `updating` | 更新中 | Pending message 重发 |
| `abort` | 用户取消 | AbortController.abort() |

### XMarkdown 流式渲染

```tsx
// packages/web/src/features/chat/components/ChatSessionView.tsx
<XMarkdown
  content={message.content}
  streaming={{ hasNextChunk: message.status === 'loading' }}
/>
```

- `hasNextChunk=true` 时：显示尾部闪烁光标动画
- 由 `useXChat` 的 `message.status` 字段驱动

### 请求中断处理

```typescript
// useXChat requestFallback
requestFallback: (_requestParams, error) => {
  if ((error as Error)?.message?.includes('AbortError')) {
    return { content: '已取消回复' }  // 保留已有内容
  }
  return { content: '网络异常，请稍后重试' }
}
```

### Pending Message 模式

临时会话消息通过 `sessionStorage` 传递：

1. 用户在首页输入 → `submitTempChat(content)` → 创建临时会话 → `sessionStorage.setItem(pendingKey, JSON)`
2. 导航到新 tab → `ChatPageByTab` 检测 `sessionStorage` 中 pending 数据
3. `queueMicrotask` 延迟发送（等待 React 渲染完成后自动发送）
4. 发送后清除 pending 数据

## Companion SSE 管道（底层实现）

### 完整数据流

```
fetch (POST /api/companions/chat)
  → AbortController (用户取消支持)
    → ReadableStream.getReader() (逐块读取)
      → TextDecoder + buffer 累积
        → 手动 SSE 行解析 (regex)
          → token/done/error 事件分发
            → Zustand useCompanionStore
              → CompanionTypingIndicator (打字机动画)
```

### CompanionSseClient — 原生 SSE 解析

```typescript
// packages/web/src/features/companion/sse-client.ts
// 手动逐行解析 SSE 帧格式: event:{type}\ndata:{payload}\n\n
const eventMatch = buffer.match(/event:(.+)\ndata:(.*)/)
if (eventMatch) {
  const eventType = eventMatch[1].trim()
  const eventData = JSON.parse(eventMatch[2].trim())
  // 分发: token / done / error
}
```

核心特点：
- **buffer 累积**：`ReadableStream` 可能分片，需要 buffer 拼接完整帧
- **双 `\n\n` 分隔**：SSE 标准帧分隔符
- **手动 JSON parse**：不依赖第三方 SSE 库

### CompanionChatPage 事件处理

```typescript
// packages/web/src/features/companion/components/CompanionChatPage.tsx
const handleEvent = (event: CompanionSseEvent) => {
  if (event.event === 'token') {
    appendStreamingChunk(chunk)           // 逐 token 累积
  } else if (event.event === 'done') {
    updateMessage(assistantId, {           // 完成：固化消息
      content: data.content || streamingContent,
      streaming: false,
    })
  } else if (event.event === 'error') {
    toast.error('AI 回复出错，请重试')
  }
}
```

### Zustand 流式状态

```typescript
// packages/web/src/features/companion/store.ts
interface CompanionState {
  streamingContent: string
  streamingMessageId: string | null
  isStreaming: boolean

  appendStreamingChunk: (chunk: string) => void  // 逐块追加
  resetStreaming: () => void                       // 异常清理
}
```

- `appendStreamingChunk`: `streamingContent += chunk` 逐 token 拼接
- `done` 事件时：`updateMessage(id, { content, streaming: false })` 固化
- `error` 事件时：`resetStreaming()` 清空临时状态

---

## 后端 SSE 基础设施

### SseResponseHelper 帧格式

```typescript
// packages/server/src/common/helpers/sse-response.helper.ts
// 标准 SSE 帧格式: event:{name}\ndata:{JSON}\n\n
write(event: string, data: unknown) {
  this.raw.write(`event: ${event}\n`)
  this.raw.write(`data: ${JSON.stringify(data)}\n\n`)
}
```

### chatMessagesChunkSchema 共享契约

```typescript
// packages/data/src/schemas/chat.schema.ts
const chatMessagesChunkSchema = z.object({
  event: z.enum(['message', 'message_end', 'error']),
  conversation_id: z.string(),
  message_id: z.string(),
  answer: z.string(),
  done: z.boolean().optional(),
  error: z.string().optional(),
})
```

三种事件类型：
- `message` — 增量 token，`answer` 字段累积内容
- `message_end` — 流结束，`done: true`
- `error` — 异常，`error` 字段描述

### AbortController + Fastify 断开监听

```typescript
// 客户端断开时 AbortController
const controller = new AbortController()
sseClient.chat({ signal: controller.signal })

// 后端监听 Fastify close 事件
reply.raw.on('close', () => {
  // 清理资源、中止 LLM 生成
})
```

### Fastify CORS 透传

后端写 raw response 时会手动拷贝 CORS 头：

```typescript
// packages/server/src/common/helpers/sse-response.helper.ts
const corsHeaders = ['access-control-allow-origin', 'access-control-allow-credentials', 'vary']
for (const header of corsHeaders) {
  const value = reply.getHeader(header)
  if (value) reply.raw.setHeader(header, value)
}
```

原因：Fastify `inject` 模式下的 reply 头不会自动传播到原生 response，直接 write raw 时丢失 CORS 头会导致浏览器阻止。

---

## 双轨对比总结

| 特性 | Chat Schema SSE | Companion Native SSE |
|------|----------------|---------------------|
| **依赖** | `@ant-design/x-sdk` | `fetch` API |
| **帧格式** | Zod schema `chatMessagesChunkSchema` | 自定义 `event:token/done/error` |
| **内容累积** | `Provider.transformMessage` 增量 | Zustand `streamingContent += chunk` |
| **渲染** | `XMarkdown streaming.hasNextChunk` | `CompanionTypingIndicator` 逐字 |
| **中断** | `AbortController` + `requestFallback` | `AbortController` + store reset |
| **适用** | Markdown 丰富的正式对话 | 纯文本情感化陪伴对话 |

---

## 常见问题

### Chat 的 alova 是否用于 SSE？

**不。** Chat 的 alova 仅用于普通 CRUD API（`getSessions`、`getMessages`、`getProviders` 等 `.send()` 模式）。SSE 通过 `@ant-design/x-sdk` 的 `XRequest` 实现。

### 如何为新的对话模块选择 SSE 方案？

- 如果输出包含 **Markdown**（代码块、表格、列表）→ Chat 方案（`@ant-design/x-sdk`）
- 如果输出是 **纯文本**，需要模拟真人打字 → Companion 方案（原生 fetch + 打字机）
- 如果需要 **完全自定义** SSE 帧格式 → Companion 方案

---

## 代码引用

| 规范 | 参考文件 |
|------|----------|
| Chat SSE Client | `packages/web/src/api/x-chat.ts` |
| GoferChatProvider | `packages/web/src/features/chat/providers/GoferChatProvider.ts` |
| ChatPageByTab (useXChat) | `packages/web/src/features/chat/components/ChatPageByTab.tsx` |
| ChatSessionView (XMarkdown) | `packages/web/src/features/chat/components/ChatSessionView.tsx` |
| CompanionSseClient | `packages/web/src/features/companion/sse-client.ts` |
| CompanionChatPage | `packages/web/src/features/companion/components/CompanionChatPage.tsx` |
| Companion Store | `packages/web/src/features/companion/store.ts` |
| SseResponseHelper | `packages/server/src/common/helpers/sse-response.helper.ts` |
| chatMessagesChunkSchema | `packages/data/src/schemas/chat.schema.ts` |
