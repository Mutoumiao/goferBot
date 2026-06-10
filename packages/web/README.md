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
public/                     # [静态资源] 不经过构建打包，直接复制到 dist
├── images/
│   └── login-illustration.png
├── favicon.ico
├── manifest.json
└── robots.txt

src/
├── api/                    # [API 层] alova Method 封装 — 所有 HTTP 请求的唯一出口
│   ├── auth.ts             #   login / register / getMe / refresh
│   ├── chat.ts             #   sendMessage / streamChat / getHistory / sessions CRUD
│   ├── kb.ts               #   getKbList / createKb / deleteKb / getKbDetail / uploadFile
│   └── file.ts             #   folders CRUD + documents CRUD（8 个方法）
│
├── features/               # [业务领域] Feature First 架构 — 按业务领域拆分
│   ├── auth/               #   认证领域
│   │   ├── store.ts        #     登录/注册页状态（tab / rememberEmail）
│   │   ├── services.ts     #     业务编排：loginUser / registerUser / logoutUser / refreshAuth
│   │   └── components/
│   │       ├── LoginForm.tsx
│   │       ├── RegisterForm.tsx
│   │       └── AuthContainer.tsx
│   │
│   ├── chat/               #   对话领域
│   │   ├── store.ts        #     会话状态：sessions / messages / SSE streaming
│   │   ├── services.ts     #     业务编排：loadChatSessions / createChatSession / deleteChatSession
│   │   ├── types.ts        #     Chat 领域类型
│   │   ├── hooks.ts        #     useChatStream 等 Chat 专用 hooks
│   │   └── components/
│   │       ├── ChatHome.tsx
│   │       ├── ChatInput.tsx
│   │       ├── ChatMessage.tsx
│   │       ├── ChatSessionList.tsx
│   │       ├── ChatSessionPage.tsx
│   │       ├── ChatHistoryList.tsx
│   │       ├── ChatHistoryPage.tsx
│   │       ├── EditorPlaceholder.tsx
│   │       └── KnowledgeBaseSelector.tsx
│   │
│   └── kb/                 #   知识库领域
│       ├── store.ts        #     KB 状态：entries / folders / documents / uploadTasks
│       ├── services.ts     #     业务编排：fetchKbList / loadKbItems / uploadFiles / removeDocument
│       ├── types.ts        #     KB 领域类型（Folder / DocumentItem / UploadTask）
│       └── components/
│           ├── KnowledgeBasePage.tsx
│           ├── KnowledgeBaseList.tsx
│           ├── KnowledgeBaseToolbar.tsx
│           ├── FileBrowser.tsx
│           ├── FileGridItem.tsx
│           ├── FileListItem.tsx
│           ├── UploadDropZone.tsx
│           └── UploadProgressBar.tsx
│
├── stores/                 # [全局状态] 跨 feature 共享的 Zustand stores
│   ├── auth.ts             #   persist — token / user / isAuthenticated
│   ├── settings.ts         #   persist — LLM 配置 / dirty 追踪 / provider 管理
│   └── tabs.ts             #   persist — 多标签管理 / home 标签保护
│
├── utils/                  # [工具层] 纯函数 / 基础设施 — 无副作用，可跨模块复用
│   ├── server.ts           #   alovaInstance — HTTP 客户端（baseURL/auth/401刷新/解包）
│   ├── llm-config.ts       #   LLM 配置工具 — getLLMConfig / mergeAppConfig / DEFAULT_CONFIG
│   ├── sse-parser.ts       #   SSE chunk 解析 — parseSSEChunk / SSEChunk 类型
│   ├── password-encryption.ts # 密码加密 — encryptPassword / clearPublicKeyCache
│   └── cn.ts               #   class 合并 — clsx + tailwind-merge
│
├── components/             # [视图层] 跨 feature 复用的 React 组件 — 禁止 barrel 文件
│   ├── sidebar/            #   Sidebar
│   └── tab-bar/            #   TabBar
│
├── routes/                 # [路由层] TanStack Router file-based routing
│   ├── __root.tsx          #   根路由（layout 壳）
│   ├── index.tsx           #   / — 重定向到 /app/chat
│   ├── login.tsx           #   /login
│   ├── register.tsx        #   /register
│   └── app/                #   /app/* — route.tsx 通过 beforeLoad 校验 token
│       ├── route.tsx       #     应用布局（Sidebar + TabBar + Outlet）
│       ├── index.tsx       #     /app — 重定向到 /app/chat
│       ├── chat.tsx        #     /app/chat — Chat 主页
│       ├── chat/$sessionId.tsx  # /app/chat/$sessionId — 具体会话页
│       ├── kb.tsx          #     /app/kb — 知识库页面
│       ├── history.tsx     #     /app/history — 历史记录页面
│       ├── settings.tsx    #     设置页面
│       └── recycle-bin.tsx #     回收站页面
│
├── overlays/               # [浮层系统] Dialog / ContextMenu 管理
│   ├── types/              #   overlay.types.ts
│   ├── host/               #   OverlayHost.tsx + overlay-store.ts
│   ├── hooks/              #   useOverlay.ts
│   └── services/           #   overlay-service.ts
│
└── tests/                  # [测试] vitest + happy-dom + @testing-library/react
    ├── auth/               #   auth store / services / api / components / password-encryption
    ├── chat/               #   chat store / services
    ├── kb/                 #   kb store / services
    ├── history/            #   history page
    └── components/         #   tab-bar 等跨 feature 组件
```

---

## 架构数据流

```
用户操作 → Component (features/*/components/* 或 routes/*)
              │
              ├─ 读取状态 ← Zustand Store (features/*/store.ts 或 stores/*)
              │                │
              └─ 触发 action ─┼─ 同步 action → set() 更新 state
                               │
                               └─ 异步 action → Service (features/*/services.ts)
                                                    │
                                                    ├─ 调用 API Method (api/*)
                                                    │       │
                                                    │       └─ alovaInstance → 后端
                                                    │               │
                                                    │               └─ .send() → Promise<Data>
                                                    │
                                                    └─ 更新 Store / Toast / 跳转
```

- **alovaInstance** (`src/utils/server.ts`)：`baseURL: '/api'`、auth 头注入、401 自动刷新、响应 `{ data }` 自动解包、GET 5 分钟缓存
- **SSE 流式**：alova `useSSE` hook + `parseSSEChunk()` 解析

---

## 已有封装速查

> 详细规则约束见 `.claude/rules/web-package-rules.md`。下面列出**当前已有的文件和方法**，开发前确认不重复造轮子。

### Utils

| 文件                           | 导出                                                                               | 用途                       |
|--------------------------------|------------------------------------------------------------------------------------|----------------------------|
| `utils/server.ts`              | `alovaInstance`                                                                    | HTTP 客户端，建新 API 必用 |
| `utils/llm-config.ts`          | `getLLMConfig()` / `mergeAppConfig()` / `DEFAULT_CONFIG` / `configuredProviders()` | LLM 配置读取/合并          |
| `utils/sse-parser.ts`          | `parseSSEChunk()` / `SSEChunk`                                                     | SSE 流式 chunk 解析        |
| `utils/password-encryption.ts` | `encryptPassword()` / `clearPublicKeyCache()`                                      | RSA 密码加密               |
| `lib/utils.ts`                 | `cn()`                                                                             | Tailwind class 合并        |

### API 方法

| 文件          | 方法                                                                                                                                    |
|---------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `api/auth.ts` | `login` / `register` / `getMe` / `refresh`                                                                                              |
| `api/chat.ts` | `sendMessage` / `streamChat` / `getHistory` / `getSessions` / `createSession` / `deleteSession` / `renameSession`                       |
| `api/kb.ts`   | `getKbList` / `createKb` / `deleteKb` / `getKbDetail` / `uploadFile`                                                                    |
| `api/file.ts` | `getFolders` / `createFolder` / `renameFolder` / `deleteFolder` / `getDocuments` / `deleteDocument` / `renameDocument` / `moveDocument` |

### Feature Stores

| Store               | 所属领域 | 类型    | 核心字段                                                                   | 核心 actions                                                                                                                  |
|---------------------|----------|---------|----------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| `useAuthPageStore`  | auth     | plain   | `tab`, `rememberEmail`                                                     | `setTab()` / `setRememberEmail()`                                                                                             |
| `useChatStore`      | chat     | plain   | `sessions`, `messages`, `isStreaming`, `streamingContent`, `activeSession` | `loadSessions()` / `createSession()` / `deleteSession()` / `appendStreamContent()` / `flushStreamContent()` / `sendMessage()` |
| `useKbStore`        | kb       | plain   | `entries`, `folders`, `documents`, `uploadTasks`, `currentKbId`            | `setEntries()` / `addEntry()` / `loadItems()` / `addTask()` / `processQueue()` / `breadcrumb()`                               |

### Global Stores

| Store              | 类型    | 核心字段                                                 | 核心 actions                                                                                                                  |
|--------------------|---------|----------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| `useAuthStore`     | persist | `token`, `user`, `isAuthenticated`                       | `setAuth()` / `clearAuth()`                                                                                                   |
| `useSettingsStore` | persist | `config: AppConfig`, `savedConfig`, `isLoading`, `error` | `updateConfig()` / `loadConfig()` / `saveConfig()` / `getLLMConfig()` / `isDirty()` / `resetToSaved()`                        |
| `useTabsStore`     | persist | `tabs: Tab[]`, `activeTabId`                             | `openRoute()` / `removeTab()` / `activateTab()` / `closeAllTabs()` / `closeOtherTabs()` / `renameTab()` / `updateActiveTabSession()` / `setTabDirty()` / `findTabByRoute()` |

### Feature Services

| 领域 | 文件                    | 关键函数                                                                                                    |
|------|-------------------------|-------------------------------------------------------------------------------------------------------------|
| auth | `features/auth/services.ts` | `loginUser()` / `registerUser()` / `logoutUser()` / `refreshAuth()` / `fetchCurrentUser()` / `getRememberedEmail()` |
| chat | `features/chat/services.ts` | `loadChatSessions()` / `createChatSession()` / `renameChatSession()` / `deleteChatSession()` / `loadChatHistory()` / `confirmDeleteChatSession()` |
| kb   | `features/kb/services.ts`   | `fetchKbList()` / `loadKbItems()` / `removeDocument()` / `renameDocument()` / `moveDocument()` / `createFolder()` / `uploadFiles()` |

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
  useChatStore.setState(useChatStore.getInitialState?.() ?? {
    activeSession: null, messages: [], isStreaming: false, streamingContent: '',
    sessions: [], isLoadingSessions: false, error: null, isLoadingHistory: false,
  })
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
- [ ] 新增功能先判断属于哪个 feature（`kb/chat/file/auth`），在 `features/` 对应目录内开发
- [ ] 需要新 Store 时已确定是 feature 级（`features/*/store.ts`）还是全局级（`stores/*`）
- [ ] `store.ts` 只存状态，业务逻辑写在 `services.ts`
- [ ] 组件通过 `services.ts` 触发业务，不自编 async 流程
- [ ] 所有异步 action 遵循 `try/catch + isLoading + error` 模式
- [ ] 组件 import 使用直接路径，未使用 barrel 文件
- [ ] 已检查上方"已有封装速查"表，确认不重复造轮子
- [ ] 测试文件放在 `tests/` 目录，未使用 jest-dom matchers
- [ ] persist store 测试使用 `vi.resetModules() + await import()` 模式
- [ ] API mock 放在文件最顶部，每个函数返回 `{ send: vi.fn() }`

---

## 技术栈

| 类别     | 技术                                                             |
|----------|------------------------------------------------------------------|
| 框架     | TanStack Start + TanStack Router                                 |
| UI       | React 19 + Tailwind CSS v4 + shadcn/ui                           |
| 状态管理 | Zustand 5（persist / plain）                                     |
| HTTP     | alova 3（`alovaInstance` + `useSSE` / `useRequest`）             |
| 测试     | Vitest 4 + happy-dom + @testing-library/react                    |
| 类型     | TypeScript 5（strict / verbatimModuleSyntax）                    |
| 别名     | `@/` → `./src/`，`@goferbot/data` → workspace 子包（类型 + 运行时 schema）|
