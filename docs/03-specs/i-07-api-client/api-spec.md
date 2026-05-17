---
issue_id: i-07-api-client
type: api-spec
status: approved
summary: 前端 TypeScript 客户端公共接口（非 HTTP API）：ApiClient 类提供 get/post/patch/delete/sse 方法签名，ApiClientError/ApiError/NetworkError 错误体系，RequestOptions 配置类型。
---
# API Spec: API Client（TypeScript 客户端接口）

> Issue: i-07-api-client
> 状态: draft
> 日期: 2026-05-16

---

## 1. 概述

本文档定义前端 TypeScript API 客户端的公共接口，非 HTTP API。所有前端 store/service 通过此客户端与后端通信。

---

## 2. 错误类型

### 2.1 ApiClientError（抽象基类）

```typescript
export abstract class ApiClientError extends Error {
  abstract readonly type: 'api' | 'network'
}
```

### 2.2 ApiError

```typescript
export interface ApiErrorPayload {
  status: number
  code: string
  message: string
  raw?: unknown
}

export class ApiError extends ApiClientError {
  readonly type = 'api' as const
  readonly status: number
  readonly code: string
  readonly raw?: unknown

  constructor(payload: ApiErrorPayload) {
    super(payload.message)
    this.status = payload.status
    this.code = payload.code
    this.raw = payload.raw
  }
}
```

### 2.3 NetworkError

```typescript
export class NetworkError extends ApiClientError {
  readonly type = 'network' as const
  readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.cause = cause
  }
}
```

---

## 3. 配置类型

### 3.1 RequestConfig

```typescript
export interface RequestConfig {
  /** 请求路径（不含 baseURL） */
  path: string
  /** 请求方法 */
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** 请求体（仅 POST/PATCH） */
  body?: unknown
  /** 自定义请求头 */
  headers?: Record<string, string>
  /** 超时时间（毫秒），默认 30000 */
  timeout?: number
  /** 外部 AbortSignal，用于手动取消 */
  signal?: AbortSignal
}
```

### 3.2 SSEConfig

```typescript
export interface SSEConfig {
  /** 自定义请求头 */
  headers?: Record<string, string>
  /** 超时时间（毫秒），默认 300000（5 分钟） */
  timeout?: number
  /** 外部 AbortSignal，用于手动取消 */
  signal?: AbortSignal
}
```

### 3.3 SSECallbacks

```typescript
export interface SSECallbacks<T = unknown> {
  /** 收到每个 SSE 数据块时调用 */
  onChunk: (chunk: T) => void
  /** 发生错误时调用 */
  onError: (error: ApiError | NetworkError) => void
  /** 流正常结束时调用 */
  onDone: () => void
}
```

---

## 4. 拦截器类型

```typescript
export type RequestInterceptor = (
  config: RequestConfig
) => RequestConfig | Promise<RequestConfig>

export type ResponseInterceptor = (
  response: Response,
  config: RequestConfig
) => Response | Promise<Response>
```

---

## 5. ApiClient 接口

```typescript
export interface ApiClient {
  /** GET 请求，返回解析后的 JSON */
  get<T = unknown>(path: string, options?: Pick<RequestConfig, 'headers' | 'timeout' | 'signal'>): Promise<T>

  /** POST 请求，返回解析后的 JSON */
  post<T = unknown>(
    path: string,
    body?: unknown,
    options?: Pick<RequestConfig, 'headers' | 'timeout' | 'signal'>
  ): Promise<T>

  /** PATCH 请求，返回解析后的 JSON */
  patch<T = unknown>(
    path: string,
    body?: unknown,
    options?: Pick<RequestConfig, 'headers' | 'timeout' | 'signal'>
  ): Promise<T>

  /** DELETE 请求，返回 void */
  delete(
    path: string,
    options?: Pick<RequestConfig, 'headers' | 'timeout' | 'signal'>
  ): Promise<void>

  /** SSE 流式请求 */
  sse<T = unknown>(
    path: string,
    body: unknown,
    callbacks: SSECallbacks<T>,
    options?: SSEConfig
  ): void

  /** 注册请求拦截器 */
  addRequestInterceptor(interceptor: RequestInterceptor): void

  /** 注册响应拦截器 */
  addResponseInterceptor(interceptor: ResponseInterceptor): void

  /** 设置全局 401 处理钩子 */
  onUnauthorized: ((error: ApiError) => void) | null
}
```

---

## 6. 工厂函数

```typescript
export interface CreateApiClientOptions {
  /** API 基础地址，默认读取 import.meta.env.VITE_API_BASE_URL 或 http://localhost:3000 */
  baseURL?: string
  /** 默认请求头 */
  defaultHeaders?: Record<string, string>
  /** 默认超时（毫秒） */
  defaultTimeout?: number
}

export function createApiClient(options?: CreateApiClientOptions): ApiClient
```

---

## 7. 单例导出

```typescript
// packages/webui/src/api/client.ts
export const api: ApiClient = createApiClient()
```

前端 store 直接导入使用：

```typescript
import { api } from '@/api/client'
```

---

## 8. DTO 类型（与后端手动同步）

当前阶段不使用 Hono RPC，DTO 类型定义在前端 `packages/webui/src/api/types.ts`，需与后端保持同步。

### 8.1 认证相关

```typescript
export interface SignInRequest {
  email: string
  password: string
}

export interface SignUpRequest {
  email: string
  password: string
  name?: string
}

export interface AuthSession {
  id: string
  email: string
  name: string | null
}
```

### 8.2 聊天相关

```typescript
export interface ChatRequest {
  message: string
  sessionId: string
  knowledgeBaseIds?: string[]
  config: {
    provider: string
    model: string
    baseUrl: string
    apiKey: string
  }
}

export interface ChatChunk {
  chunk: string
  done: boolean
}
```

### 8.3 知识库相关

```typescript
export interface KnowledgeBase {
  id: string
  name: string
  path: string
  created_at: number
  deleted_at: number | null
  is_pinned: number
  sort_order: number
  icon: string
}

export interface FileItem {
  name: string
  type: 'file' | 'directory'
  size?: number
  updatedAt: number
}
```

---

## 9. 使用示例

### 9.1 GET 请求

```typescript
import { api } from '@/api/client'
import type { KnowledgeBase } from '@/api/types'

const kbs = await api.get<KnowledgeBase[]>('/api/knowledge-bases')
```

### 9.2 POST 请求

```typescript
const kb = await api.post<KnowledgeBase>('/api/knowledge-bases', { name: '新项目' })
```

### 9.3 错误处理

```typescript
import { ApiError, NetworkError } from '@/api/errors'

try {
  await api.post('/api/knowledge-bases', { name: '' })
} catch (err) {
  if (err instanceof ApiError) {
    console.error('HTTP 错误:', err.status, err.message)
  } else if (err instanceof NetworkError) {
    console.error('网络错误:', err.message)
  }
}
```

### 9.4 注册 401 钩子

```typescript
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

api.onUnauthorized = (error) => {
  authStore.clearSession()
  window.location.href = '/login'
}
```

### 9.5 SSE 请求

```typescript
import { api } from '@/api/client'
import type { ChatChunk } from '@/api/types'

const controller = new AbortController()

api.sse<ChatChunk>(
  '/api/chat',
  {
    message: '你好',
    sessionId: 'sess-123',
    config: { provider: 'openai', model: 'gpt-4', baseUrl: '', apiKey: '' }
  },
  {
    onChunk: (chunk) => {
      if (!chunk.done) {
        appendText(chunk.chunk)
      }
    },
    onError: (err) => {
      showError(err.message)
    },
    onDone: () => {
      setStreaming(false)
    }
  },
  { signal: controller.signal }
)

// 用户点击停止
controller.abort()
```

### 9.6 拦截器示例

```typescript
// 请求拦截器：添加日志
api.addRequestInterceptor((config) => {
  console.log(`[API] ${config.method} ${config.path}`)
  return config
})

// 响应拦截器：性能监控
api.addResponseInterceptor(async (response, config) => {
  console.log(`[API] ${config.method} ${config.path} -> ${response.status}`)
  return response
})
```

---

## 10. 与后端契约对照

| 前端方法 | 后端端点 | 方法 | 认证 |
|----------|----------|------|------|
| `api.post('/api/auth/sign-in/email', ...)` | `/api/auth/sign-in/email` | POST | 公开 |
| `api.post('/api/auth/sign-up/email', ...)` | `/api/auth/sign-up/email` | POST | 公开 |
| `api.post('/api/auth/sign-out')` | `/api/auth/sign-out` | POST | Cookie |
| `api.get('/api/auth/session')` | `/api/auth/session` | GET | Cookie |
| `api.get('/api/knowledge-bases')` | `/api/knowledge-bases` | GET | Cookie |
| `api.sse('/api/chat', ...)` | `/api/chat` | POST | Cookie |

所有端点均通过 `credentials: 'include'` 携带 Session Cookie。
