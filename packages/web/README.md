# packages/web — GoferBot 前端

GoferBot 的用户端 React SPA。基于 TanStack Start 构建，提供 Chat 对话（SSE 流式）、知识库管理、文件浏览、配置管理等核心功能。

> **开发前先读规则**：`.claude/rules/web-package-rules.md` 包含所有强制约束（禁止 fetch、alova 模式、Zustand 模式、测试 mock 策略）。本 README 提供目录索引和代码示例。

---

## 快速开始

```bash
pnpm dev              # 启动 Vite dev server
pnpm build            # 生产构建
pnpm test             # 运行全部测试（vitest run）
npx tsc --noEmit      # TypeScript 类型检查
```

Node >= 22，依赖由 pnpm workspace 统一管理。

---

## 目录结构

```
src/
├── api/                    # [API 层] alova Method 封装 — 所有 HTTP 请求的唯一出口
│   ├── auth.ts             #   login / register / getMe / refresh
│   ├── chat.ts             #   sendMessage / streamChat / getHistory / sessions CRUD
│   ├── kb.ts               #   getKbList / createKb / deleteKb / getKbDetail / uploadFile
│   └── file.ts             #   folders CRUD + documents CRUD（8 个方法）
│
├── stores/                 # [状态层] Zustand stores
│   ├── auth.ts             #   persist — token / user / isAuthenticated
│   ├── settings.ts         #   persist — LLM 配置 / dirty 追踪 / provider 管理
│   ├── tabs.ts             #   persist — 多标签管理 / home 标签保护
│   ├── chat.ts             #   plain  — sessions / messages / SSE streaming
│   ├── kb.ts               #   plain  — 知识库条目 / 选中状态
│   └── file.ts             #   plain  — 上传队列(并发控制) / 文件浏览 CRUD
│
├── utils/                  # [工具层] 纯函数 / 基础设施 — 无副作用，可跨模块复用
│   ├── server.ts           #   alovaInstance — HTTP 客户端（baseURL/auth/401刷新/解包）
│   ├── llm-config.ts       #   LLM 配置工具 — getLLMConfig / mergeAppConfig / DEFAULT_CONFIG
│   ├── sse-parser.ts       #   SSE chunk 解析 — parseSSEChunk / SSEChunk 类型
│   └── cn.ts               #   class 合并 — clsx + tailwind-merge
│
├── components/             # [视图层] React 组件 — 禁止 barrel 文件
│   ├── chat/               #   ChatInput / MessageBubble / EditorPlaceholder
│   ├── sidebar/            #   Sidebar
│   └── tab-bar/            #   TabBar
│
├── routes/                 # [路由层] TanStack Router file-based routing
│   ├── __root.tsx          #   根路由（layout 壳）
│   ├── login.tsx           #   /login
│   ├── register.tsx        #   /register
│   └── app/                #   /app/* — route.tsx 通过 beforeLoad 校验 token
│       ├── chat.tsx        #     ChatViewPage — useSSE 流式 + 错误重试
│       ├── kb.tsx          #     知识库页面（骨架）
│       ├── history.tsx     #     历史页面（骨架）
│       ├── settings.tsx    #     设置页面（骨架）
│       └── recycle-bin.tsx #     回收站页面（骨架）
│
├── overlays/               # [浮层系统] Dialog / ContextMenu 管理
│   ├── types/              #   overlay.types.ts
│   ├── host/               #   OverlayHost.tsx + overlay-store.ts
│   ├── hooks/              #   useOverlay.ts
│   └── services/           #   overlay-service.ts
│
tests/                      # [测试] vitest + happy-dom + @testing-library/react
    ├── auth-store.spec.ts
    ├── settings-store.spec.ts
    ├── tabs-store.spec.ts
    ├── chat-store.spec.ts
    ├── chat-sse.spec.tsx
    ├── chat-input-streaming.spec.tsx
    ├── file-store.spec.ts
    ├── overlay-store.spec.ts
    └── cn-utility.spec.ts
```

---

## 架构数据流

```
用户操作 → Component (routes/* / components/*)
              │
              ├─ 读取状态 ← Zustand Store (stores/*)
              │                │
              └─ 触发 action ─┼─ 同步 action → set() 更新 state
                               │
                               └─ 异步 action → API Method (api/*) → alovaInstance → 后端
                                                  │
                                                  └─ .send() → Promise<Data>
```

- **alovaInstance** (`src/utils/server.ts`)：`baseURL: '/api'`、auth 头注入、401 自动刷新、响应 `{ data }` 自动解包、GET 5 分钟缓存
- **SSE 流式**：alova `useSSE` hook + `parseSSEChunk()` 解析

---

## 已有封装速查

> 详细规则约束见 `.claude/rules/web-package-rules.md`。下面列出**当前已有的文件和方法**，开发前确认不重复造轮子。

### Utils

| 文件 | 导出 | 用途 |
|------|------|------|
| `utils/server.ts` | `alovaInstance` | HTTP 客户端，建新 API 必用 |
| `utils/llm-config.ts` | `getLLMConfig()` / `mergeAppConfig()` / `DEFAULT_CONFIG` / `configuredProviders()` | LLM 配置读取/合并 |
| `utils/sse-parser.ts` | `parseSSEChunk()` / `SSEChunk` | SSE 流式 chunk 解析 |
| `utils/cn.ts` | `cn()` | Tailwind class 合并 |

### API 方法

| 文件 | 方法 |
|------|------|
| `api/auth.ts` | `login` / `register` / `getMe` / `refresh` |
| `api/chat.ts` | `sendMessage` / `streamChat` / `getHistory` / `getSessions` / `createSession` / `deleteSession` / `renameSession` |
| `api/kb.ts` | `getKbList` / `createKb` / `deleteKb` / `getKbDetail` / `uploadFile` |
| `api/file.ts` | `getFolders` / `createFolder` / `renameFolder` / `deleteFolder` / `getDocuments` / `deleteDocument` / `renameDocument` / `moveDocument` |

### Stores

| Store | 类型 | 核心字段 | 核心 actions |
|-------|------|---------|-------------|
| `useAuthStore` | persist | `token`, `user`, `isAuthenticated` | `setAuth()` / `clearAuth()` |
| `useSettingsStore` | persist | `config: AppConfig`, `savedConfig`, `isLoading`, `error` | `updateConfig()` / `loadConfig()` / `saveConfig()` / `getLLMConfig()` / `isDirty()` / `resetToSaved()` |
| `useTabsStore` | persist | `tabs: Tab[]`, `activeTabId` | `addTab()` / `addTabByRoute()` / `removeTab()` / `closeAllTabs()` / `closeOtherTabs()` / `activeTab()` |
| `useChatStore` | plain | `sessions`, `messages`, `isStreaming`, `streamingContent`, `activeSession` | `loadSessions()` / `createSession()` / `deleteSession()` / `appendStreamContent()` / `flushStreamContent()` / `sendMessage()` |
| `useKbStore` | plain | `entries`, `isLoading`, `selectedId` | `setEntries()` / `addEntry()` / `removeEntry()` / `setSelectedId()` |
| `useFileStore` | plain | `uploadTasks`, `folders`, `documents`, `currentKbId` | `addTask()` / `processQueue()` / `loadItems()` / `deleteDocument()` / `createFolder()` / `breadcrumb()` |

---

## 测试代码片段

> 强制规则（禁止 jest-dom、mock 位置、store 重置策略）见 `.claude/rules/web-package-rules.md`。下面仅提供可直接复制的代码模板。

### API Mock

```typescript
// 模块级 mock — 必须放文件最顶部
vi.mock('@/api/chat', () => ({
  getSessions: vi.fn(() => ({ send: vi.fn().mockResolvedValue({ sessions: [...] }) })),
  createSession: vi.fn(() => ({ send: vi.fn().mockResolvedValue(newSession) })),
  deleteSession: vi.fn(() => ({ send: vi.fn().mockResolvedValue(undefined) })),
}))

// 测试中调整返回值
import * as chatApi from '@/api/chat'
const mockFn = chatApi.getSessions as ReturnType<typeof vi.fn>
mockFn.mockReturnValue({ send: vi.fn().mockRejectedValue(new Error('网络错误')) })
```

### Store 重置

```typescript
// Plain store — direkt setState
beforeEach(() => {
  useChatStore.setState(useChatStore.getInitialState())
})

// Persist store — 必须 vi.resetModules() + await import()
beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  const { useTabsStore } = await import('@/stores/tabs')
  useTabsStore.setState({ tabs: [{ ...HOME_TAB }], activeTabId: 'home' })
})
```

### 组件测试

```typescript
// 1. mock 外部依赖
vi.mock('alova/client', () => ({ useSSE: vi.fn(...), useRequest: vi.fn(...) }))

// 2. 设置 store 初始状态
beforeEach(() => {
  useChatStore.setState({ isStreaming: false, messages: [], streamingContent: '' })
})

// 3. render + 断言
it('should show stop button when streaming', () => {
  useChatStore.setState({ isStreaming: true })
  render(<ChatViewPage />)
  expect(screen.getByRole('button', { name: /停止/i })).toBeDefined()
})
```

---

## 开发检查清单

开始编写任何代码前，逐项确认：

- [ ] 已阅读 `.claude/rules/web-package-rules.md`
- [ ] HTTP 请求使用 `src/api/*.ts` 的 alova Method + `.send()`，未使用原生 `fetch`
- [ ] 需要新 API 时已在 `src/api/` 新建文件，使用 `alovaInstance` 创建 Method
- [ ] 需要新 Store 时已确定 persist 或 plain，类型定义写在 store 文件内
- [ ] 所有异步 action 遵循 `try/catch + isLoading + error` 模式
- [ ] 组件 import 使用直接路径，未使用 barrel 文件
- [ ] 已检查上方"已有封装速查"表，确认不重复造轮子
- [ ] 测试文件放在 `tests/` 目录，未使用 jest-dom matchers
- [ ] persist store 测试使用 `vi.resetModules() + await import()` 模式
- [ ] API mock 放在文件最顶部，每个函数返回 `{ send: vi.fn() }`

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | TanStack Start + TanStack Router |
| UI | React 19 + Tailwind CSS v4 + shadcn/ui |
| 状态管理 | Zustand 5（persist / plain） |
| HTTP | alova 3（`alovaInstance` + `useSSE` / `useRequest`） |
| 测试 | Vitest 4 + happy-dom + @testing-library/react |
| 类型 | TypeScript 5（strict / verbatimModuleSyntax） |
| 别名 | `@/` → `./src/`，`@goferbot/data` → `../data/src/types/index.ts` |
