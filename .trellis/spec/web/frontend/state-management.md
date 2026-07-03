# 状态管理

> 本项目中状态管理的模式和约定。

---

## 概述

项目使用 **Zustand** 作为状态管理库，采用分层状态管理策略：

| 层级 | 状态类型 | 存储位置 | 示例 |
|------|----------|----------|------|
| **全局状态** | 用户认证、设置、工作区 | `stores/` | `useAuthStore`, `useSettingsStore` |
| **模块状态** | 聊天、知识库、伴侣 | `features/*/store.ts` | `useChatStore`, `useKbStore` |
| **组件状态** | 局部 UI 状态 | 组件内部 | `useState`, `useReducer` |
| **服务端状态** | API 响应缓存 | alova | `useRequest` |

---

## 全局状态

### 全局状态定义

全局状态定义在 `stores/` 目录，使用 Zustand 的 `create` 函数：

```tsx
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  
  setUser: (user: User) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      
      setUser: (user) => set({ user, isAuthenticated: true }),
      clearAuth: () => set({ user: null, isAuthenticated: false }),
    }),
    { name: 'goferbot-auth' }
  )
)
```

### 持久化策略

使用 Zustand 的 `persist` middleware 进行持久化：

| Store | 持久化方式 | 用途 |
|-------|-----------|------|
| `useAuthStore` | localStorage | 刷新后恢复用户资料 |
| `useSettingsStore` | localStorage | 持久化用户设置 |
| `useWorkspaceStore` | sessionStorage | 标签页状态（仅当前会话） |
| `useConversationStore` | 不持久化 | 消息缓存（内存） |

### 持久化配置示例

```tsx
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: '',
      // ... actions
    }),
    {
      name: 'gofer-workspace-v1',
      version: 1,
      partialize: (state) => ({ tabs: state.tabs, activeTabId: state.activeTabId }),
      storage: createJSONStorage(() => sessionStorage),
      migrate: (persistedState, version) => {
        // 版本迁移逻辑
        return persistedState as WorkspaceState
      },
    }
  )
)
```

---

## 模块状态

### 模块状态定义

功能模块的局部状态定义在 `features/*/store.ts`：

```tsx
import { create } from 'zustand'
import type { Message, Session } from '@goferbot/data'

interface ChatState {
  activeSession: Session | null
  messages: Message[]
  isStreaming: boolean
  streamingContent: string
  
  setActiveSession: (session: Session | null) => void
  setMessages: (messages: Message[]) => void
  appendStreamContent: (chunk: string) => void
  flushStreamContent: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeSession: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  
  setActiveSession: (session) => set({ activeSession: session }),
  setMessages: (messages) => set({ messages }),
  
  appendStreamContent: (chunk) => 
    set((s) => ({ streamingContent: s.streamingContent + chunk })),
  
  flushStreamContent: () => {
    const { streamingContent, activeSession } = get()
    if (!streamingContent) return
    
    const assistantMsg: Message = {
      id: `msg-${Date.now()}`,
      sessionId: activeSession?.id ?? '',
      role: 'assistant',
      content: streamingContent,
      createdAt: new Date().toISOString(),
    }
    
    set((s) => ({
      messages: [...s.messages, assistantMsg],
      streamingContent: '',
    }))
  },
}))
```

### 模块状态职责边界

模块状态只保存 UI 状态和本地缓存，不直接发起 API 请求：

```tsx
// ✅ 正确：模块状态只管理本地状态
interface ChatState {
  messages: Message[]
  isLoadingHistory: boolean
}

// ❌ 错误：状态中不应该包含 API 调用逻辑
interface ChatState {
  loadMessages: () => Promise<void>  // 应该放在 services.ts
}
```

---

## 服务端状态

### alova 请求封装

服务端状态通过 alova 的 `useRequest` 管理，统一处理加载态、错误和刷新：

```tsx
import { useRequest } from 'alova/client'
import { getSessions } from '@/api/chat'

export function useChatHistory(page: number, pageSize: number) {
  const { data, loading, error, send: reload } = useRequest(
    () => getSessions(page, pageSize),
    { immediate: true }
  )
  
  return { data, loading, error, reload }
}
```

### 请求共享

alova 配置了 `shareRequest: true`，相同请求会自动合并：

```tsx
// 多个组件调用相同的 API，只会发起一次请求
const { data: user1 } = useRequest(getMe, { immediate: true })
const { data: user2 } = useRequest(getMe, { immediate: true })
```

### 缓存策略

```tsx
export const alovaInstance = createAlova({
  // ...
  cacheFor: {
    GET: 0,     // 默认不缓存 GET 请求
    POST: 0,
    PUT: 0,
    DELETE: 0,
  },
})
```

---

## 状态通信

### Chat 双层 Store 同步（重要模式）

Chat 模块使用**两个 Zustand Store** 分层管理状态：

```typescript
// packages/web/src/features/chat/store.ts
const useChatStore = create<ChatState>(...)         // UI 状态 + providers + sessionCache

// packages/web/src/stores/conversation.store.ts  
const useConversationStore = create<ConversationState>(...)  // 按 conversationId 隔离消息
```

两个 Store 通过 `useEffect` 在组件中同步：

```typescript
// packages/web/src/features/chat/components/ChatPageByTab.tsx
const { messages } = useXChat(...)  // @ant-design/x-sdk 管理的消息

useEffect(() => {
  // 将 useXChat 的消息同步到全局 conversation store
  useConversationStore.getState().setMessages(conversationId, messages)
}, [messages, conversationId])
```

**分层理由**：
- `useChatStore`：生命周期短（随 tab 切换重建），管理 UI 状态（isStreaming、providers、pending messages）
- `useConversationStore`：生命周期长（内存常驻），按 conversationId 隔离消息，跨 tab 共享

### Companion 流式 Store 模式

```typescript
// packages/web/src/features/companion/store.ts
interface CompanionState {
  streamingContent: string           // 当前流式内容
  streamingMessageId: string | null  // 正在流式的消息 ID
  isStreaming: boolean               // 流式状态锁

  appendStreamingChunk: (chunk: string) => void   // 逐块追加
  updateMessage: (id, partial) => void             // 完成时固化消息
  resetStreaming: () => void                        // 异常清理
}
```

**流式生命周期**：
1. 用户发送 → `addMessage({ streaming: true, content: '' })` → `setStreamingMessageId(id)` → `setIsStreaming(true)`
2. SSE `token` 事件 → `appendStreamingChunk(chunk)` → `streamingContent += chunk`
3. SSE `done` 事件 → `updateMessage(id, { content, streaming: false })` → `setIsStreaming(false)`
4. SSE `error` 事件 / 用户取消 → `resetStreaming()` → 清空临时状态

### Store 之间通信

通过 `getState()` 在 store 外部访问其他 store：

```tsx
// services.ts 中跨 store 通信
import { useChatStore } from './store'
import { useWorkspaceStore } from '@/stores/workspace.store'

export async function createChatSession() {
  const { addSession, setActiveSession } = useChatStore.getState()
  const { addTab } = useWorkspaceStore.getState()
  
  const newSession = await apiCreateSession().send()
  addSession(newSession)
  setActiveSession(newSession)
  
  addTab({ type: 'chat', title: newSession.title, conversationId: newSession.id })
}
```

### 组件间通信

通过 props 向下传递或使用共享 store：

```tsx
// 通过 props 传递
<ParentComponent>
  <ChildComponent onAction={handleAction} />
</ParentComponent>

// 通过共享 store
const { user } = useAuthStore()
<ChildComponent userId={user?.id} />
```

---

## 最佳实践

### 选择器优化

使用 Zustand 选择器避免不必要的重渲染：

```tsx
// ✅ 推荐：使用选择器
const userName = useAuthStore((state) => state.user?.name)

// ✅ 推荐：使用 shallow 比较复杂对象
import { shallow } from 'zustand'
const { user, isAuthenticated } = useAuthStore((state) => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
}), shallow)

// ❌ 不推荐：订阅整个 store
const { user } = useAuthStore()
```

### 异步操作

异步操作放在 `services.ts` 中，不在 store 中直接处理：

```tsx
// services.ts — 业务编排
export async function loadChatSessions() {
  const { setSessions, setIsLoadingSessions, setError } = useChatStore.getState()
  setIsLoadingSessions(true)
  try {
    const res = await getSessions().send()
    setSessions(res.items ?? [])
  } catch (e) {
    setError(e instanceof Error ? e.message : '加载失败')
  } finally {
    setIsLoadingSessions(false)
  }
}
```

### 不可变更新

Zustand 的 `set` 函数支持不可变更新：

```tsx
// ✅ 正确：不可变更新
set((state) => ({
  items: [...state.items, newItem],
}))

// ✅ 正确：Map 不可变更新
set((state) => {
  const cache = new Map(state.sessionCache)
  cache.set(sessionId, { messages, loaded: true })
  return { sessionCache: cache }
})
```

### DevTools

开发环境启用 Zustand DevTools：

```tsx
import { devtools } from 'zustand/middleware'

export const useWorkspaceStore = create<WorkspaceStore>()(
  devtools(
    persist(
      (set, get) => ({
        // ...
      }),
      { name: 'gofer-workspace-v1' }
    ),
    { name: 'WorkspaceStore', enabled: import.meta.env?.DEV ?? true }
  )
)
```

---

## 状态管理模式总结

### 选择决策树

```
状态需要跨组件共享？
  ├── 是 → 需要持久化？
  │       ├── 是（用户资料、设置）→ 全局 Zustand + persist
  │       └── 否（临时状态）→ 全局 Zustand
  └── 否 → 数据来自 API？
          ├── 是 → alova useRequest
          └── 否 → React useState/useReducer
```

### 状态分类表

| 状态类型 | 管理方式 | 持久化 | 示例 |
|----------|----------|--------|------|
| 用户认证 | Zustand 全局 | localStorage | `useAuthStore` |
| 用户设置 | Zustand 全局 | localStorage | `useSettingsStore` |
| 工作区标签 | Zustand 全局 | sessionStorage | `useWorkspaceStore` |
| 会话消息 | Zustand 全局 | 内存 | `useConversationStore` |
| 聊天模块 | Zustand 模块 | 内存 | `useChatStore` |
| 知识库模块 | Zustand 模块 | 内存 | `useKbStore` |
| API 响应 | alova | 内存 | `useRequest` |
| 组件局部 | useState | 内存 | 表单状态 |

---

## 常见错误

### 错误示例

| 错误 | 描述 | 修复方式 |
|------|------|----------|
| 直接在 store 中调用 API | `loadData: async () => {...}` | 移到 services.ts |
| 不使用选择器订阅 store | `const { user } = useAuthStore()` | 使用选择器 |
| 在组件中直接更新其他模块的 store | `useChatStore.getState().setMessages(...)` | 通过 services.ts |
| 持久化敏感数据 | `persist({ accessToken })` | accessToken 由 HttpOnly Cookie 管理 |
| 状态分散在多个 store | 同一业务的状态拆分到多个 store | 合并到一个模块 store |

### 正确示例

```tsx
// ✅ 正确：分层状态管理
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/features/chat/store'
import { loadChatSessions } from '@/features/chat/services'

function ChatHistoryPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { sessions, isLoadingSessions } = useChatStore((s) => ({
    sessions: s.sessions,
    isLoadingSessions: s.isLoadingSessions,
  }))
  
  useEffect(() => {
    if (isAuthenticated) {
      loadChatSessions()
    }
  }, [isAuthenticated])
  
  if (isLoadingSessions) return <Spinner />
  return <SessionList sessions={sessions} />
}
```

---

## 代码引用

| 规范 | 参考文件 |
|------|----------|
| 认证状态 | `packages/web/src/stores/auth.ts` |
| 设置状态 | `packages/web/src/stores/settings.ts` |
| 工作区状态 | `packages/web/src/stores/workspace.store.ts` |
| 聊天模块状态 | `packages/web/src/features/chat/store.ts` |
| 知识库模块状态 | `packages/web/src/features/KnowledgeBase/store.ts` |
| 业务服务层 | `packages/web/src/features/chat/services.ts` |