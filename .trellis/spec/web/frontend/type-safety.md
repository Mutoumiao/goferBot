# 类型安全

> 本项目的类型模式和校验规范。

---

## 概述

项目使用 **TypeScript** 进行类型安全，共享类型定义存储在 `@goferbot/data` 包中。前端通过 alova 请求自动获取后端返回类型，配合 Zod schema 进行运行时校验。

---

## 类型来源

### 共享类型（@goferbot/data）

前后端共享的类型定义在 `packages/data/src/schemas/` 目录：

```tsx
import type { User, Session, Message, ProviderListItem } from '@goferbot/data'
```

**共享类型清单**：

| Schema 文件 | 导出类型 |
|-------------|----------|
| `auth.schema.ts` | `User`, `AuthResponse`, `LoginRequest`, `RegisterRequest` |
| `chat.schema.ts` | `Session`, `Message`, `ProviderListItem`, `SessionListResponse` |
| `companion.schema.ts` | `Companion`, `CompanionMessage`, `CompanionMemory` |
| `kb.schema.ts` | `KbEntry`, `KnowledgeBase` |
| `document.schema.ts` | `Document`, `DocumentItem` |
| `folder.schema.ts` | `Folder` |
| `session.schema.ts` | `Session`, `Message` |
| `settings.schema.ts` | `AppConfig`, `ProviderConfig` |
| `common.schema.ts` | `Pagination`, `PaginationType` |

### 前端专属类型

前端专属类型定义在各模块的 `types.ts` 文件中：

```tsx
// features/chat/types.ts
export interface ChatState {
  messages: Message[]
  isStreaming: boolean
}

// features/KnowledgeBase/types.ts
export interface UploadTask {
  id: string
  name: string
  progress: number
  status: 'queued' | 'uploading' | 'completed' | 'failed'
  error?: string
}
```

---

## 类型模式

### 接口定义

使用 `interface` 定义复杂类型：

```tsx
interface User {
  id: string
  name: string
  email: string
  avatarUrl?: string
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
  createdAt: string
}
```

### 联合类型

使用联合类型定义有限的选项：

```tsx
type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

type UploadStatus = 'queued' | 'uploading' | 'completed' | 'failed'
```

### 类型别名

使用 `type` 定义复杂类型：

```tsx
type SessionId = string
type UserId = string
type ConversationId = string

type PaginationType = {
  total: number
  size: number
  totalPage: number
  currentPage: number
  hasNextPage: boolean
  hasPrevPage: boolean
}
```

### 泛型

使用泛型创建可复用的类型：

```tsx
type ApiResponse<T> = {
  data: T
  code: number
  message?: string
}

type PaginatedResponse<T> = {
  items: T[]
  pagination: PaginationType
}
```

---

## 类型校验

### alova 请求类型

alova 请求自动推断返回类型：

```tsx
import { alovaInstance } from '@/utils/server'
import type { SessionListResponse } from '@goferbot/data'

// 请求返回类型自动推断为 SessionListResponse
export const getSessions = () =>
  alovaInstance.Get<SessionListResponse>('/chat/sessions')
```

### Zod Schema 校验

前端使用 Zod 进行运行时校验：

```tsx
import { z } from 'zod'

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  captchaId: z.string().optional(),
  captchaCode: z.string().optional(),
})

type LoginRequest = z.infer<typeof LoginSchema>

// 校验请求数据
const result = LoginSchema.safeParse(data)
if (!result.success) {
  console.error(result.error)
}
```

### 类型守卫

使用类型守卫进行类型收窄：

```tsx
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as User).id === 'string'
  )
}

const user = await fetchUser()
if (isUser(user)) {
  console.log(user.name)  // user 类型为 User
}
```

---

## 最佳实践

### 避免 `any`

禁止使用 `any` 类型，使用 `unknown` 代替：

```tsx
// ❌ 禁止
const data: any = await fetchData()

// ✅ 正确
const rawData: unknown = await fetchData()
const data = parseData(rawData)
```

### 避免类型断言

避免使用 `as` 进行不安全的类型断言：

```tsx
// ❌ 禁止
const user = data as User

// ✅ 正确：使用类型守卫
if (isUser(data)) {
  const user = data
}

// ✅ 正确：使用 Zod 校验
const result = UserSchema.safeParse(data)
if (result.success) {
  const user = result.data
}
```

### 使用 `satisfies`

使用 `satisfies` 进行类型检查而不改变类型：

```tsx
const config = {
  providers: {},
  temperature: 0.7,
  appearance: 'light',
} satisfies AppConfig
```

### 索引类型

使用索引类型访问对象属性：

```tsx
type ProviderKey = keyof ProviderConfig
type ProviderValue = ProviderConfig[keyof ProviderConfig]
```

---

## 状态管理类型

### Zustand Store 类型

Zustand store 使用 interface 定义状态和操作：

```tsx
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

### Store 选择器类型

使用选择器时指定返回类型：

```tsx
const userName = useAuthStore((state) => state.user?.name)
// userName 类型为 string | undefined

const user = useAuthStore((state) => state.user)
// user 类型为 User | null
```

---

## API 层类型

### 请求类型

从 `@goferbot/data` 导入请求类型：

```tsx
import type { LoginRequest, RegisterRequest } from '@goferbot/data'

export const login = (data: LoginRequest) =>
  alovaInstance.Post<AuthResponse>('/web/auth/login', data)
```

### 响应类型

使用 alova 泛型参数指定响应类型：

```tsx
export const getMe = () => alovaInstance.Get<User>('/auth/me')

export const getSessions = (page?: number, pageSize?: number) =>
  alovaInstance.Get<SessionListResponse>('/chat/sessions', {
    params: { page, pageSize },
  })
```

---

## 组件 Props 类型

### 扩展原生 Props

使用 `ComponentPropsWithoutRef` 扩展原生元素属性：

```tsx
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: 'primary' | 'secondary' | 'outline'
  children?: ReactNode
}
```

### 函数组件类型

使用 `FC` 类型定义函数组件：

```tsx
import type { FC } from 'react'

interface GreetingProps {
  name: string
}

const Greeting: FC<GreetingProps> = ({ name }) => {
  return <div>Hello, {name}</div>
}
```

---

## 错误类型

### 自定义错误类型

扩展 Error 类型添加额外属性：

```tsx
interface ApiError extends Error {
  status?: number
  code?: string
  cause?: unknown
}

const err = new Error('Network error') as ApiError
err.status = 503
err.code = 'NETWORK_ERROR'
```

### 错误处理类型

使用联合类型处理不同的错误场景：

```tsx
type ErrorState = {
  error: string | null
  errorCode?: string
}

type LoadingState = {
  isLoading: boolean
  error: string | null
}
```

---

## 代码引用

| 规范 | 参考文件 |
|------|----------|
| 共享类型定义 | `packages/data/src/schemas/` |
| alova 实例配置 | `packages/web/src/utils/server.ts` |
| 前端类型定义 | `packages/web/src/features/chat/types.ts` |
| Zustand store 类型 | `packages/web/src/stores/auth.ts` |
| API 层类型 | `packages/web/src/api/auth.ts` |