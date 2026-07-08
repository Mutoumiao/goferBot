# GoferBot Discovery Report

## 7. 复杂模块

### 7.17 Web SSE 流式客户端 — Chat + Companion 双轨 SSE 架构

**数据来源**：[x-chat.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/api/x-chat.ts)、[GoferChatProvider.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/chat/providers/GoferChatProvider.ts)、[ChatPageByTab.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/chat/components/ChatPageByTab.tsx)、[ChatSessionView.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/chat/components/ChatSessionView.tsx)、[sse-client.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/companion/sse-client.ts)、[CompanionChatPage.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/companion/components/CompanionChatPage.tsx)、[sse-response.helper.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/common/helpers/sse-response.helper.ts)、[chat.schema.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/data/src/schemas/chat.schema.ts#L62-L69)

Chat 和 Companion 采用**两种完全不同的 SSE 客户端方案**，形成有趣的"高抽象 vs 低控制"对比。

#### Chat SSE 管线（高层抽象，@ant-design/x-sdk）

```
后端 SseResponseHelper
  → write({ data: { event, conversation_id, message_id, answer, done?, error? } })
  → HTTP Response: text/event-stream
  ──────────────────────── 网络 ────────────────────────
前端 XRequest (manual: true, authedFetch 自动注入 Authorization)
  → AbstractChatProvider 消费 SSE chunks
    → transformMessage: originMessage.content += chunk.answer (增量累积)
      → useXChat hook: 管理消息列表、loading/success/error/local/updating/abort 6 态
        → Bubble.List + XMarkdown streaming.hasNextChunk (光标动画)
```

**关键组件**：

- **XRequest** (`[x-chat.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/api/x-chat.ts)`): `@ant-design/x-sdk` 的 SSE 请求方法，`manual: true` 表示由 `useXChat` 手动触发。通过 `authedFetch` 工厂注入 `Authorization` header
- **GoferChatProvider** (`[GoferChatProvider.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/chat/providers/GoferChatProvider.ts)`): 继承 `AbstractChatProvider`，实现三个核心方法：
  - `transformParams`: 映射 GoferInput → API 请求体（response_mode: 'streaming'）
  - `transformLocalMessage`: 从 query 创建本地 user 消息
  - `transformMessage`: 增量累积 `{ content: originMessage.content + chunk.answer }`，JSON 解析失败静默忽略
- **useXChat** (`[ChatPageByTab.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/chat/components/ChatPageByTab.tsx#L56-L80)`): 管理完整 SSE 生命周期 — requestPlaceholder("正在思考中...") → transformMessage 累积 → requestFallback 错误处理
- **XMarkdown streaming** (`[ChatSessionView.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/chat/components/ChatSessionView.tsx#L75-L83)`): `streaming.hasNextChunk={status === 'loading' || status === 'updating'}` 驱动光标动画
- **Pending Message 模式**: 临时会话 → createChatSession → sessionStorage.setItem(pendingKey) → 导航 → ChatPageByTab 检测 → queueMicrotask 自动发送

**错误处理** (`[ChatPageByTab.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/features/chat/components/ChatPageByTab.tsx#L68-L79)`):
- `AbortError` → "已取消回复"（保留已有内容）
- 其他 → "网络异常，请稍后重试"

**状态管理双层架构**:
- `useChatStore` (Zustand): UI 状态 + providers + sessionCache（本地）
- `useConversationStore` (Zustand): 按 conversationId 隔离消息，生命周期跨 tab
- 通过 `useEffect` 同步 `useXChat` 消息到 conversationStore

#### Companion SSE 管线（底层实现，原生 fetch）

```
后端 SseResponseHelper
  → write({ event: 'token', data: "chunk text" })
  → write({ event: 'done', data: { messageId, content, createdAt } })
  ──────────────────────── 网络 ────────────────────────
前端 CompanionSseClient (fetch + ReadableStream)
  → reader.read() → TextDecoder → buffer 累积
    → split('\n') → regex 解析 event:xxx\ndata:...
      → onEvent({ event: 'token', data }) → appendStreamingChunk (Zustand)
      → onEvent({ event: 'done', data }) → updateMessage(id, { content, streaming: false })
```

**关键差异**：Companion 的 SSE `data` 字段为**纯文本 token**（非 JSON），done 事件才传 JSON `{ messageId, content, createdAt }`。Chat 的每个 chunk 的 data 字段都为 JSON。

#### 两种方案对比

| 维度 | Chat (@ant-design/x-sdk) | Companion (原生 fetch) |
|------|-------------------------|----------------------|
| SSE 传输 | `XRequest` 方法调用 | `fetch` + `ReadableStream.getReader()` |
| 消息累积 | `AbstractChatProvider.transformMessage` 自动增量 | 手动 `appendStreamingChunk` + Zustand |
| Markdown 渲染 | `XMarkdown streaming.hasNextChunk` 光标动画 | 纯文本渲染（无 Markdown streaming） |
| 状态管理 | `useXChat` hook 全托管 | `useCompanionStore` (Zustand) 手动管理 |
| 中断控制 | `useXChat.abort()` 内置 | 手动 `AbortController` |
| 错误恢复 | `requestFallback` 自动回退 | `doneReceived` 标记 + toast |
| 消息生命周期 | 6 态 (loading/success/error/local/updating/abort) | 3 态 (streaming: true/false) |

#### 后端 SSE 基础设施

**SseResponseHelper** (`[sse-response.helper.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/common/helpers/sse-response.helper.ts)`) 为 Common 模块的 `@Injectable({ scope: Scope.REQUEST })` 服务，核心机制：

- **SSE 帧格式**: `event: {name}\ndata: {JSON.stringify(data)}\n\n`
- **客户端断开检测**: Fastify `reply.raw.on('close')` → AbortController.abort() → 上游 LLM 调用取消
- **CORS 透传**: 手动将 Fastify reply 的 `access-control-*` + `vary` 头拷贝到 raw response，防止直接写 raw 时丢失跨域头
- **错误帧**: `writeError(error, context)` → `event: error\ndata: { conversation_id, message_id, error }\n\n` → `end()`

#### 共享契约

Chat SSE 消息格式由 `packages/data` 的 `chatMessagesChunkSchema` ([chat.schema.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/data/src/schemas/chat.schema.ts#L62-L69)) 定义：

```ts
{ event: 'message' | 'message_end' | 'error', conversation_id: UUID, message_id: UUID, answer: string, done?: boolean, error?: string }
```

Companion SSE 不走此契约，使用自己的 `token | done | error` 事件格式。

#### 重要修正

**Chat 实际不使用 alova 进行 SSE**：alova 仅用于 Chat 模块的普通 CRUD API（getSessions/getMessages/getChatProviders 等，使用 `.send()` 模式）。SSE 流式通信通过 `@ant-design/x-sdk` 的 `XRequest` + `authedFetch` 实现，这是一个专用的 SSE 传输层。

***
