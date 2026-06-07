---
issue: f-40
type: feature-spec
status: draft
---

# f-40 Session Store 功能规格

## 用户故事

**作为** 前端开发者
**我需要** 一个管理会话列表和 CRUD 操作的 Zustand store
**以便** ChatView 和历史页面能统一读写会话状态，替代 Pinia session store

## 功能边界

### 包含

- 扩展 `packages/web/src/stores/chat.ts`，添加 `sessions: Session[]` 列表状态
- 会话 CRUD：`loadSessions` / `createSession` / `renameSession` / `deleteSession`
- `error` 字段统一承载操作错误信息
- `isLoadingSessions` 独立于 `isLoadingHistory` 的加载态
- 保留已有 streaming 相关状态（`isStreaming` / `streamingContent` / `appendStreamContent` / `flushStreamContent`）
- `sendMessage` 方法保留骨架（具体 SSE 逻辑由 f-44 实现）

### 不包括

- SSE 流式接收实现（f-44）
- 聊天页面 UI 组件（f-44 / f-45）
- 后端 API 修改
- History 页面改动

## 数据模型

```typescript
// 复用 @goferbot/data 中的 Session 类型
interface Session {
  id: string
  title: string
  provider: string | null
  model: string | null
  messageCount: number
  createdAt: string
  updatedAt: string
}

// 扩展后的 ChatState
interface ChatState {
  // ===== 已有字段 =====
  activeSession: Session | null
  messages: Message[]
  isLoadingHistory: boolean
  isStreaming: boolean
  streamingContent: string

  // ===== 新增字段 =====
  sessions: Session[]
  isLoadingSessions: boolean
  error: string | null

  // ===== 已有 actions =====
  setActiveSession: (session: Session | null) => void
  setMessages: (messages: Message[]) => void
  appendMessage: (message: Message) => void
  setIsLoadingHistory: (v: boolean) => void
  setIsStreaming: (v: boolean) => void
  appendStreamContent: (chunk: string) => void
  flushStreamContent: () => void
  clearChat: () => void

  // ===== 新增 actions =====
  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  removeSession: (id: string) => void
  updateSession: (id: string, updates: Partial<Session>) => void
  loadSessions: () => Promise<void>
  createSession: () => Promise<Session | undefined>
  renameSession: (id: string, title: string) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  sendMessage: (content: string, knowledgeBaseIds?: string[]) => Promise<void>
  clearError: () => void
}
```

## API 契约

### Store 对外暴露

| 方法 | 签名 | 说明 |
|------|------|------|
| `setSessions` | `(sessions: Session[]) => void` | 同步批量设置会话列表 |
| `addSession` | `(session: Session) => void` | 同步添加单个会话到列表头部 |
| `removeSession` | `(id: string) => void` | 同步移除会话（同时清理 active） |
| `updateSession` | `(id: string, updates: Partial<Session>) => void` | 同步更新会话字段 |
| `loadSessions` | `() => Promise<void>` | 异步加载会话列表，设置 `sessions`，失败设置 `error` |
| `createSession` | `() => Promise<Session \| undefined>` | 异步创建会话，成功添加到列表头部+激活，失败设置 `error` |
| `renameSession` | `(id: string, title: string) => Promise<void>` | 异步重命名，成功用 `updateSession` 更新本地 |
| `deleteSession` | `(id: string) => Promise<void>` | 异步删除，成功用 `removeSession` 清理本地 |
| `sendMessage` | `(content: string, knowledgeBaseIds?: string[]) => Promise<void>` | 发送消息骨架（f-44 对接） |
| `clearError` | `() => void` | 清除 `error` |

### 依赖的 api/chat.ts 方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `getSessions()` | `Promise<{ sessions: Session[] }>` | 已有 |
| `createSession()` | `Promise<Session>` | 已有 |
| `deleteSession(id)` | `Promise<void>` | 已有 |

**注**：`renameSession` 对应的 API 方法 `renameSession(id, title)` 若不存在，需在 `api/chat.ts` 中添加。

## 验收标准映射

| AC | 描述 | 优先级 |
|----|------|--------|
| AC-01 | 扩展 `sessions` + `isLoadingSessions` + `error` 状态字段 | p0 |
| AC-02 | 实现 `setSessions` / `addSession` / `removeSession` / `updateSession` 同步 actions | p0 |
| AC-03 | 实现 `loadSessions` 异步 action（调 api，成功→setSessions，失败→error） | p0 |
| AC-04 | 实现 `createSession` 异步 action（调 api，成功→addSession+激活，失败→error） | p0 |
| AC-05 | 实现 `renameSession` 异步 action（调 api，成功→updateSession） | p1 |
| AC-06 | 实现 `deleteSession` 异步 action（调 api，成功→removeSession+清理 active） | p0 |
| AC-07 | `deleteSession` 时若删除的是 activeSession，将 activeSession 置 null | p0 |
| AC-08 | 已有 streaming 行为不受扩展影响（向后兼容） | p0 |
