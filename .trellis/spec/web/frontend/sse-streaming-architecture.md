# SSE 流式架构开发指南

> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为 [openspec/specs/chat/spec.md](../../../../openspec/specs/chat/spec.md) 和 [openspec/specs/companion/spec.md](../../../../openspec/specs/companion/spec.md)（WHAT）。`chatMessagesChunkSchema` 共享契约 / 双轨 SSE 业务分轨理由 应以 OpenSpec 为准。
>
> **客户端运行时（Knowledge Chat）**：AI SDK `useChat` + `KnowledgeChatTransport`。**不再**使用 `@ant-design/x-sdk` 的 `useXChat` / `AbstractChatProvider`。Markdown 仍可用 `@ant-design/x-markdown`。

---

## Purpose

帮助开发者在 Web 端 SSE 流式架构中高效工作。本指南聚焦两条业务线（Knowledge Chat / Companion）在 **同一 AI SDK 运行时范式** 下的 Transport 映射、调试技巧与可复用模式，不重复业务契约定义。

## Primary OpenSpec

- [openspec/specs/chat/spec.md](../../../../openspec/specs/chat/spec.md) — Chat SSE 流式契约（`chatMessagesChunkSchema`、事件类型业务语义、Web 客户端运行时）
- [openspec/specs/companion/spec.md](../../../../openspec/specs/companion/spec.md) — Companion SSE 流式契约（LangGraph 管线）

## Related OpenSpec

- [openspec/specs/auth/spec.md](../../../../openspec/specs/auth/spec.md) — Cookie 会话凭证（`credentials: 'include'`）

## Module Dependencies

- `ai` / `@ai-sdk/react` — `useChat` + 自定义 `ChatTransport`
- `@ant-design/x-markdown` — Markdown 流式渲染（`XMarkdown` streaming）
- 原生 `fetch` + `ReadableStream` — Transport 内消费 Nest SSE
- `zustand` — 会话列表 / conversation 缓存（非流式状态机权威）
- `zod` — 仅用于 OpenSpec / packages/data 契约校验，前端不重复定义 wire schema

## Development Entry

- `packages/web/src/features/chat/knowledge-chat-transport.ts` — Nest Chat SSE → UIMessageChunk
- `packages/web/src/features/chat/message-sources.ts` — `getMessageSources` / `getRetrievalEmpty` / `historyMessageToUiMessage`
- `packages/web/src/features/chat/components/ChatSessionPanel.tsx` — I2：`useChat` 随 `sessionId` 挂载
- `packages/web/src/features/chat/components/ChatSessionView.tsx` — shadcn 列表 + Composer + XMarkdown
- `packages/web/src/features/KnowledgeBase/components/KbInlineChat.tsx` — 同 Transport，固定 KB
- `packages/web/src/features/companion/companion-chat-transport.ts` — Companion SSE → UIMessageChunk（**独立**，不与 Chat 合并）
- `packages/web/src/features/companion/sse-client.ts` — Companion SSE 帧解析
- `packages/web/src/features/companion/components/CompanionChatPage.tsx` — Companion useChat 接入

---

## Scenario: KnowledgeChatTransport 线级映射（跨层契约）

> 本 change 触发 **Mandatory Triggers**：跨层 request/response 契约（浏览器 Transport ↔ Nest Chat SSE）。下列 7 节为可执行 code-spec。

### 1. Scope / Trigger

- **Trigger**：Knowledge Chat Web 主路径用 AI SDK 消费 Nest 既有 SSE；线级协议 **零变更**（不改 `chatMessagesChunkSchema`、不改 Companion 事件枚举）。
- **In scope**：`KnowledgeChatTransport`、`message-sources` 选择器、`ChatSessionPanel` I2、`KbInlineChat`。
- **Out of scope**：AI Data Stream 协议、卸 x-markdown、与 Companion Transport 合并、RAG 检索质量优化。

### 2. Signatures

```typescript
// packages/web/src/features/chat/knowledge-chat-transport.ts
export class KnowledgeChatTransport implements ChatTransport<UIMessage> {
  constructor(options?: {
    baseUrl?: string
    getConversationId?: () => string
    getKnowledgeBaseIds?: () => string[]
    getProviderKey?: () => string | undefined
    getRetrievalMode?: () => 'strict' | 'loose'
  })
  sendMessages(options: {
    trigger: 'submit-message' | 'regenerate-message'
    chatId: string
    messageId: string | undefined
    messages: UIMessage[]
    abortSignal: AbortSignal | undefined
    headers?: Record<string, string> | Headers
    body?: object
  }): Promise<ReadableStream<UIMessageChunk>>
}

export function parseChatSseBlock(
  block: string,
): { event: string; data: Record<string, unknown> } | null

// packages/web/src/features/chat/message-sources.ts
export function getMessageSources(msg: UIMessage): ChatSourceItem[] | undefined
export function getRetrievalEmpty(msg: UIMessage): boolean
export function textFromUiMessage(msg: UIMessage): string
export function historyMessageToUiMessage(message: {
  id: string
  role: string
  content: string
  metadata?: unknown
}): UIMessage
```

**HTTP（Nest 既有，Transport 调用侧）**：

| 项 | 值 |
|----|-----|
| Method / Path | `POST {baseUrl}/chat-messages` |
| Auth | `credentials: 'include'` + 可选 `Authorization`（`buildAuthHeader`） |
| Content-Type | `application/json` |

### 3. Contracts

**Request body（Transport → Nest）**

| 字段 | 类型 | 约束 |
|------|------|------|
| `response_mode` | `'streaming'` | 固定 |
| `query` | string | 末条 user 文本，非空 |
| `conversation_id` | string | body / getter / `chatId` 解析，非空 |
| `knowledge_base_ids` | string[] | ≥1；KbInline 固定当前库 |
| `provider_key` | string? | 可选 |
| `retrieval_mode` | `'strict' \| 'loose'` | 默认 strict |
| `parent_message_id` / `inputs` / `files` | optional | 透传 body |

**Wire SSE（Nest → Transport，零变更）**

| Wire `event` | AI SDK chunk | 说明 |
|--------------|--------------|------|
| `sources` | `data-sources` | 可先于 text；含 `sources[]`、`retrieval_empty?` |
| `message` | `text-start` + `text-delta` | `answer` 增量 |
| `message_end` | `text-end?` + `finish` | 定稿；**常不带完整 sources 列表** |
| `error` | `error` + `finish` | **保留**已收 text |
| 坏 JSON / 未知 event | 忽略 | 不中断流 |

**UI 读取（唯一路径）**

- 流式：`data-sources` part；`getMessageSources` 取 **最后一次** 有效 `data-sources`。
- 历史：`historyMessageToUiMessage` 写入 metadata + 同构 `data-sources` part。
- **禁止**第三份 sources 权威 store。

### 4. Validation & Error Matrix

| 条件 | 行为 |
|------|------|
| 无 `conversation_id` | throw `缺少 conversation_id…`（不发请求） |
| 空 query | throw `消息内容为空` |
| `knowledge_base_ids.length === 0` | throw `请先选择至少一个知识库` |
| HTTP `!response.ok` | throw `Chat SSE 请求失败: {status}` |
| 无 `response.body` | throw `ReadableStream 不可用` |
| 坏 JSON SSE 帧 | `parseChatSseBlock` 返回 null，忽略 |
| 流中 `error` 事件 | enqueue error + finish；**不**清空已收 text-delta |
| Abort / 面板 unmount | `abortSignal` / `stop()` 中止 reader |

### 5. Good / Base / Bad Cases

| 类 | 场景 | 期望 |
|----|------|------|
| **Good** | `sources`（非空）→ `message`* → `message_end`（无 sources 字段） | 引用保留；正文完整；finish |
| **Good** | `sources` + `retrieval_empty: true` → 固定 GUARDRAIL 正文 | 空检索提示；无假引用列表 |
| **Base** | 仅 `message`* → `message_end` | 无引用 UI；正文正常 |
| **Base** | 历史 hydrate 含 `metadata.sources` | `getMessageSources` 与流式一致 |
| **Bad** | `message_end` 无条件再 enqueue `data-sources: {sources:[]}` | **引用被清空**（见 Gotcha） |
| **Bad** | Chat 复用 `CompanionChatTransport` | 事件枚举混用，解析失败 |
| **Bad** | effect deps 含 `stop` | Maximum update depth / 串台 |

### 6. Tests Required

| 层 | 断言点 |
|----|--------|
| Unit Transport | sources 先于 text；text 增量；message_end finish；error 保留部分 text；retrieval_empty；坏帧忽略；**message_end 不覆盖已有 sources** |
| Unit message-sources | parts 优先于 metadata；最后一次 data-sources 胜出；historyMessageToUiMessage 可读 |
| 组件 / 面板 | 强制 KB；切换 sessionId stop；hydrate 后引用可见 |
| E2E（mock / real） | 选 KB → 提问 → 流式正文 + 引用摘要；历史回填；I2 不串台 |
| 回归 | Companion smoke 无回归；Chat 主路径无 `useXChat` / `GoferChatProvider` |

### 7. Wrong vs Correct

#### Wrong — message_end 覆盖 sources

```typescript
// 禁止：Nest message_end 常无 sources 字段时，用空数组再写 data-sources
if (event === 'message_end') {
  enqueue({
    type: 'data-sources',
    data: { sources: data.sources ?? [] }, // getMessageSources 取最后一次 → 清空引用
  })
  enqueue({ type: 'finish', finishReason: 'stop' })
}
```

#### Correct — 跟踪 lastSources，仅按需补写

```typescript
// 已收到 sources 事件时：message_end 若无 sources 数组，禁止补写空列表
let lastSources: unknown[] | undefined
let sourcesEventSeen = false

if (event === 'sources') {
  sourcesEventSeen = true
  lastSources = Array.isArray(data.sources) ? data.sources : []
  enqueue({ type: 'data-sources', data: { sources: lastSources, retrieval_empty: data.retrieval_empty } })
}

if (event === 'message_end') {
  if (Array.isArray(data.sources)) {
    // end 显式带列表才覆盖
    enqueue({ type: 'data-sources', data: { sources: data.sources, retrieval_empty: ... } })
  } else if (!sourcesEventSeen && data.retrieval_empty === true) {
    // 从未 sources 事件时才写空 + empty
    enqueue({ type: 'data-sources', data: { sources: [], retrieval_empty: true } })
  }
  // else: 保留既有 data-sources
  finishText()
  enqueue({ type: 'finish', finishReason: 'stop' })
}
```

#### Wrong — 第三份 sources store

```typescript
// 禁止：UI 自建 sourcesMap 作为权威
const sourcesByMsgId = useRef(new Map())
// 流式写入 map，渲染读 map —— 与 history metadata 分叉
```

#### Correct — 统一选择器

```typescript
const sources = getMessageSources(msg)
const empty = getRetrievalEmpty(msg)
```

---

## Implementation Notes

### KnowledgeChatTransport（Chat 主路径）

- POST 既有 `/chat-messages`，`credentials: 'include'` + 可选 `buildAuthHeader`。
- Body：`query` / `conversation_id` / `knowledge_base_ids`（≥1）/ `provider_key?` / `retrieval_mode`。
- **线级协议零变更**：`sources` → `message`* → `message_end` | `error`（见 OpenSpec chat）。
- **禁止**复用 `CompanionChatTransport` 类；允许复制 text-id / finish 守卫模式。
- 引用 UI：统一 `getMessageSources` / `getRetrievalEmpty`；**禁止**第三份 sources 权威 store。

### 会话实例 I2

`ChatSessionPanel(sessionId)` 挂载 = 一个 `useChat` 生命周期。切换会话：unmount → `stop()` → mount 新面板 → hydrate 历史。Effect 依赖仅 `sessionId`；`stop` / 回调经 **ref** 读取（禁止不稳定函数进 deps）。

### Pending Message 跨页传递

临时会话：首页输入 → 创建会话 → `sessionStorage` pending → 面板 mount 后 `queueMicrotask` 走同一 `sendMessage` 路径。**必须用 `queueMicrotask`**，避免 hook 未就绪。

### Companion Transport（独立）

- 事件：`token` / `done` / `error` / `summary` / `memories`（与 Chat **不**混用枚举）。
- 入口：`CompanionChatTransport` + `CompanionChatPage`。
- 详见 [companion-ui-rendering.md](./companion-ui-rendering.md)。

### Markdown 流式

`XMarkdown` 的 `streaming.hasNextChunk` 绑定 AI SDK `status === 'streaming' | 'submitted'`（末条 assistant），**不**依赖已删除的 useXChat 六态。

### 新模块 SSE 方案选择

- Knowledge Chat / 知识库同屏 → `KnowledgeChatTransport` + `useChat`
- Companion → `CompanionChatTransport` + `useChat`
- **不要**再引入 `@ant-design/x-sdk` 聊天运行时

### Design Decision: Chat 与 Companion 双 Transport

**Context**：两条业务线 SSE 事件枚举与语义不同；产品要求 Knowledge Chat 与 Companion 共用 AI SDK 运行时体验。

**Options**：
1. 合并单一 Transport + 运行时分支
2. 两套 Transport、共享模式（text-id / credentials / finish 守卫）

**Decision**：选 2。Chat 独立文件 `knowledge-chat-transport.ts`；PR 拒收无关 Companion diff。

**Extensibility**：新 SSE 产品线新建 Transport，不向现有类塞 if/else 协议分支。

---

## Testing Checklist

- [ ] Transport 单测：sources 先于 text、增量、message_end、error 保留部分内容、retrieval_empty、坏帧忽略
- [ ] Transport 单测：`message_end` 无 sources 字段时 **不**清空已展示引用
- [ ] 历史回填含 metadata.sources 可展示
- [ ] 强制 KB；KbInline 固定库
- [ ] 切换会话 stop，不串台（generation / unmount）
- [ ] Chat 主路径无 `useXChat` / `GoferChatProvider` / `AbstractChatProvider`
- [ ] Companion smoke 无回归；未误改 Companion Transport
- [ ] 后端 SSE / Zod 无行为 diff

## Review Checklist

- [ ] 新增 SSE 事件类型是否同步更新 OpenSpec（chat/spec.md 或 companion/spec.md）
- [ ] `chatMessagesChunkSchema` 字段变更是否同步更新 OpenSpec（客户端迁移 **不应** 改 wire）
- [ ] Chat / Companion Transport 是否仍隔离
- [ ] sources 是否只经统一选择器读取
- [ ] `message_end` 是否避免用空 `data-sources` 覆盖 lastSources

## Common Pitfalls

- **SSE 帧解析边界**：`ReadableStream` 分片可能切断单帧，必须 buffer 到 `\n\n`。
- **不稳定 hook 返回值进 effect deps**：`stop`/`abort` 每帧新引用 → Maximum update depth；用 ref。
- **切换会话串台**：必须 I2 unmount stop + generation 守卫。
- **坏 JSON 中断流**：Transport 内 try-catch，坏帧忽略。
- **第三份 sources store**：流式与历史必须同一 `getMessageSources` 路径。
- **message_end 清空引用**：`getMessageSources` 取最后一次 `data-sources`；Nest `message_end` 常不带 sources 列表。必须跟踪 `lastSources` / `sourcesEventSeen`，禁止无条件 `sources: []`。见上方 Wrong vs Correct。
- **误改 Companion**：Chat Transport 独立文件；PR 拒收无关 companion diff。

## Reusable Patterns

### credentials include + 可选 Authorization

```typescript
const headers: Record<string, string> = { 'Content-Type': 'application/json' }
const auth = buildAuthHeader()
if (auth) headers.Authorization = auth
await fetch(url, { method: 'POST', headers, credentials: 'include', body, signal })
```

### 会话加载 effect（仅 sessionId）

```typescript
const stopRef = useRef(stop)
useEffect(() => { stopRef.current = stop }, [stop])

useEffect(() => {
  const generation = ++streamGenerationRef.current
  stopRef.current?.()
  // resolve + load history → setMessages(hydrate)
  return () => {
    cancelled = true
    streamGenerationRef.current++
    stopRef.current?.()
  }
}, [sessionId]) // 禁止把 stop 放进 deps
```
