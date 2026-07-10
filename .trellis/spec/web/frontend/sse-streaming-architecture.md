# SSE 流式架构开发指南

> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为 [openspec/specs/chat/spec.md](../../../../openspec/specs/chat/spec.md) 和 [openspec/specs/companion/spec.md](../../../../openspec/specs/companion/spec.md)（WHAT）。chatMessagesChunkSchema 共享契约 / 双轨 SSE 业务分轨理由 应以 OpenSpec 为准。

---

## Purpose

帮助开发者在 Web 端 SSE 流式架构中高效工作。本指南聚焦两条 SSE 实现路径（`@ant-design/x-sdk` 高层抽象与原生 `fetch` 底层实现）的开发模式、调试技巧与可复用模式，不重复业务契约定义。

## Primary OpenSpec

- [openspec/specs/chat/spec.md](../../../../openspec/specs/chat/spec.md) — Chat SSE 流式契约（`chatMessagesChunkSchema`、事件类型业务语义）
- [openspec/specs/companion/spec.md](../../../../openspec/specs/companion/spec.md) — Companion SSE 流式契约（LangGraph 管线）

## Related OpenSpec

- [openspec/specs/auth/spec.md](../../../../openspec/specs/auth/spec.md) — Token 注入契约（`authedFetch` 依赖的 token 来源）

## Module Dependencies

- `@ant-design/x-sdk` — Chat SSE 客户端（`XRequest` + `useXChat`）
- `@ant-design/x-markdown` — Markdown 流式渲染（`XMarkdown` streaming）
- 原生 `fetch` + `ReadableStream` — Companion SSE 客户端
- `zustand` — 流式状态管理（`useCompanionStore`、`useChatStore`）
- `zod` — 仅用于 OpenSpec 契约校验，前端不重复定义 schema

## Development Entry

- `packages/web/src/api/x-chat.ts` — Chat XRequest 配置 + `authedFetch`
- `packages/web/src/features/chat/providers/GoferChatProvider.ts` — 增量累积 Provider
- `packages/web/src/features/chat/components/ChatPageByTab.tsx` — useXChat 接入
- `packages/web/src/features/companion/sse-client.ts` — 原生 SSE 帧解析
- `packages/web/src/features/companion/components/CompanionChatPage.tsx` — 事件分发
- `packages/web/src/features/companion/store.ts` — 流式状态 Store

## Implementation Notes

### XRequest manual: true 模式

`manual: true` 让开发者手动控制发送时机（而非声明即发），适配"先创建会话再发消息"的流程。配合 `authedFetch` 自定义 fetch 包装注入 `Authorization: Bearer <token>` header。Token 从 `useAuthStore.getState().token` 同步读取，避免闭包持有过期 token。

### GoferChatProvider transformMessage 增量累积

`AbstractChatProvider` 子类通过 `originMessage.content + chunk.answer` 逐块拼接。**关键：JSON 解析失败时静默忽略**，返回当前 `originMessage.content`，不允许抛出异常中断流式渲染——单个坏帧不应影响整体对话。

### Chat Knowledge SSE：`sources` 优先

知识问答契约（见 OpenSpec chat）事件顺序为 **`sources` → `message`* → `message_end` | `error`**：

| event | 前端处理 |
|-------|----------|
| `sources` | 写入 `GoferMessage.sources` / `retrieval_empty`；可渲染 `SourceCitations`（含 `kb_id`） |
| `message` | `content += answer`（delta） |
| `message_end` | 收尾；可带 `retrieval_empty` |
| `error` | 展示用户可读错误；保留已累积 content/sources |

请求侧：`transformParams` MUST 带上 `knowledge_base_ids`（至少 1 个）与可选 `retrieval_mode`（默认 strict）。KB 选择器 UI：`KnowledgeBaseSelector` 强制多选至少一个。

**不要**把 Companion 的 `token`/`done` 事件枚举与 Chat Knowledge 混用。

### useXChat 6 状态生命周期调试

| 状态 | 触发 | 调试要点 |
|------|------|----------|
| `loading` | `onRequest` 开始 | 流式中，`hasNextChunk=true` |
| `success` | `done` 事件 | 流结束，光标消失 |
| `error` | 网络错误 / 非正常中断 | 触发 `requestFallback` |
| `local` | `onRequest` 中的 local message | 用户输入即时显示 |
| `updating` | Pending message 重发 | `queueMicrotask` 延迟后 |
| `abort` | `AbortController.abort()` | `requestFallback` 检测 `AbortError` |

调试时优先检查 `message.status` 字段驱动 `XMarkdown.streaming.hasNextChunk`，光标动画异常通常是 status 未正确流转。

### requestFallback 中断处理

`requestFallback` 通过 `error.message.includes('AbortError')` 区分用户取消与网络异常：取消时保留已有内容，网络异常时提示重试。**不要在 fallback 中抛出异常**，否则会破坏 useXChat 状态机。

### Pending Message 跨页传递

临时会话消息通过 `sessionStorage` 传递：首页输入 → 创建临时会话 → `sessionStorage.setItem(pendingKey, JSON)` → 导航到新 tab → `queueMicrotask` 延迟发送（等待 React 渲染完成）→ 发送后清除 pending。**必须用 `queueMicrotask` 而非 `setTimeout`**，否则 useXChat 可能未挂载导致发送失败。

### 原生 SSE 帧手动解析

`ReadableStream` 可能分片送达，必须用 buffer 累积完整帧。SSE 标准帧分隔符是双 `\n\n`，手动处理 `event:` / `data:` 前缀，不依赖第三方 SSE 库：

```typescript
const eventMatch = buffer.match(/event:(.+)\ndata:(.*)/)
if (eventMatch) {
  const eventType = eventMatch[1].trim()
  const eventData = JSON.parse(eventMatch[2].trim())
  // 分发: token / done / error
}
```

### Companion 事件分发与状态固化

- `token` 事件 → `appendStreamingChunk(chunk)` 逐 token 累积
- `done` 事件 → `updateMessage(id, { content, streaming: false })` 固化
- `error` 事件 → `resetStreaming()` 清空临时状态 + `toast.error()` 提示

**关键：`done` 必须固化，`error` 必须清理**，否则 streaming 状态残留导致 UI 卡死。

### CompanionTypingIndicator 打字机动画

逐字输出模拟真人打字，由 `streamingContent` 驱动。与 Chat 的 `XMarkdown` 流式不同，Companion 是纯文本逐 token 拼接，无 Markdown 解析开销。

### 新模块 SSE 方案选择

- 输出含 **Markdown**（代码块、表格）→ Chat 方案（`@ant-design/x-sdk`）
- 输出为 **纯文本**，需模拟真人打字 → Companion 方案（原生 fetch + 打字机）
- 需 **完全自定义** SSE 帧格式 → Companion 方案

## Testing Checklist

- [ ] Chat SSE 正确接收 `message` / `message_end` / `error` 事件，内容正确累积
- [ ] Companion SSE 正确解析 `token` / `done` / `error` 事件
- [ ] 用户取消时 `AbortController.abort()` 触发，`requestFallback` 保留已有内容
- [ ] `authedFetch` 正确注入 `Authorization: Bearer <token>` header
- [ ] Token 过期时 SSE 中断后有友好提示
- [ ] 流式渲染无闪烁（`hasNextChunk` 与 `message.status` 正确绑定）
- [ ] Companion `done` 事件后 streaming 状态正确固化
- [ ] Companion `error` 事件后 streaming 状态正确清理
- [ ] Pending Message 跨页传递后自动发送

## Review Checklist

- [ ] 新增 SSE 事件类型是否同步更新 OpenSpec（chat/spec.md 或 companion/spec.md）
- [ ] `chatMessagesChunkSchema` 字段变更是否同步更新 OpenSpec
- [ ] 双轨分轨理由变更（如新增第三轨）是否同步更新 OpenSpec
- [ ] `authedFetch` token 读取方式变更是否影响所有 SSE 请求
- [ ] 新增 Provider 是否正确实现 `transformMessage` 增量累积 + 静默忽略异常

## Common Pitfalls

- **SSE 帧解析边界问题**：`ReadableStream` 分片可能切断单帧，必须 buffer 累积到完整 `\n\n` 分隔符后再解析，否则正则匹配失败。
- **Token 过期时 SSE 中断**：SSE 连接建立后 token 过期不会自动重连，需在 `error` 事件中检测 401 并引导重新登录。
- **闭包持有过期 token**：`authedFetch` 若在模块加载时读取 token 并缓存，token 刷新后仍用旧值。必须在每次 fetch 调用时同步读取。
- **`requestFallback` 抛异常**：会破坏 useXChat 状态机，导致后续消息无法发送。fallback 必须返回消息对象。
- **`done` 事件未固化**：Companion 流结束时若忘记 `updateMessage`，`streamingContent` 残留导致下次对话混入旧内容。
- **`queueMicrotask` vs `setTimeout`**：Pending Message 必须用 `queueMicrotask`，`setTimeout` 会导致 useXChat 未挂载时发送失败。
- **JSON 解析失败中断流**：`transformMessage` 中 `JSON.parse` 抛异常会中断整个流式渲染，必须 try-catch 静默忽略。

## Reusable Patterns

### authedFetch Token 注入模式

拦截所有需鉴权请求，统一从 store 同步读取 token 注入 header，避免闭包缓存：

```typescript
const authedFetch = (...args: Parameters<typeof fetch>) => {
  const token = useAuthStore.getState().token  // 同步读取，不缓存
  return fetch(args[0], {
    ...(typeof args[1] === 'object' ? args[1] : {}),
    headers: {
      ...(typeof args[1] === 'object' ? (args[1] as RequestInit).headers : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
  })
}
```

### 原生 SSE 帧解析模式

buffer 累积 + 双 `\n\n` 分隔 + 正则匹配 `event:` / `data:` 前缀，不依赖第三方库。适用于需完全自定义帧格式的场景。

### Zustand 流式状态管理模式

`streamingContent` 逐 token 追加 + `done` 固化 + `error` 清理三段式：

```typescript
appendStreamingChunk: (chunk) => set((s) => ({ streamingContent: s.streamingContent + chunk }))
resetStreaming: () => set({ streamingContent: '', streamingMessageId: null, isStreaming: false })
```

### Provider 增量累积模式

`transformMessage` 返回新对象，`originMessage.content + chunk` 拼接，异常静默忽略返回当前内容。适用于所有基于 `AbstractChatProvider` 的流式 Provider。
