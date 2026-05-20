---
issue_id: i-14-jwt-api-client
type: behavior-spec
status: approved
summary: 定义 API 客户端初始化（localStorage 恢复Token→注册拦截器）、请求携带 Authorization、401 自动刷新→刷新失败跳转 /login 的完整状态机流程，含并发请求去重刷新逻辑。
---
# Behavior Spec: JWT API Client（认证状态机与请求生命周期）

> Issue: `i-14-jwt-api-client`
> 状态: draft
> 日期: 2026-05-16
> 依赖: `i-09-nestjs-auth-system`

---

## 1. 入口：API 客户端初始化

### 1.1 初始化流程

```
应用启动（main.ts）
  │
  ▼
创建 api 客户端实例（createApiClient）
  │
  ▼
注册请求拦截器：注入 Authorization header
  │
  ▼
注册响应拦截器：处理 401 → 触发 Token 刷新
  │
  ▼
注册 onUnauthorized 钩子：由 auth store 设置，执行跳转 /login
  │
  ▼
从 localStorage 恢复 token（若存在）
  │
  ▼
初始化完成，进入未认证或已认证状态
```

### 1.2 拦截器注册顺序

```typescript
// 请求拦截器（按注册顺序）
1. authInterceptor — 读取 authStore.accessToken，注入 Authorization header

// 响应拦截器（按注册顺序）
1. refreshInterceptor — 捕获 401，触发刷新流程
```

---

## 2. 初始状态

### 2.1 未认证（No Token）

- `localStorage` 中无 `goferbot_access_token`
- `authStore.accessToken` = `null`
- `authStore.isAuthenticated` = `false`
- API 请求不携带 `Authorization` header
- 后端返回 401 时无法刷新（无 refreshToken），直接触发 `onUnauthorized`

### 2.2 已认证（Token Restored）

- `localStorage` 中存在有效的 `goferbot_access_token`
- `authStore.accessToken` = 恢复的值
- `authStore.isAuthenticated` = `true`
- 后续 API 请求自动携带 `Authorization: Bearer <token>`

---

## 3. 交互状态表

| 状态 | 触发条件 | UI 表现 | 可执行操作 |
|------|----------|---------|------------|
| `unauthenticated` | 无 Token / Token 清除 | 显示登录入口 | 调用 `login()` / `register()` |
| `loading` | `login()` / `register()` / `refresh()` 进行中 | 按钮 loading | 等待完成 |
| `authenticated` | Token 存在且有效 | 正常显示内容 | 发起任意 API 请求 |
| `refreshing` | 收到 401，正在刷新 Token | 对用户透明（后台） | 请求排队等待刷新结果 |
| `error` | 登录/注册/刷新失败 | 显示错误信息 | 重试或跳转登录页 |

### 3.1 状态转换图

```
                    ┌─────────────┐
         ┌─────────►│ unauth      │◄────────┐
         │          │ (无 token)  │         │
         │          └──────┬──────┘         │
         │                 │ login()        │
         │                 │ register()     │ logout()
         │                 ▼                │
         │          ┌─────────────┐         │
         │          │   loading   │         │
         │          └──────┬──────┘         │
         │                 │                │
         │         ┌───────┴───────┐        │
         │         ▼               ▼        │
         │   ┌─────────┐     ┌─────────┐    │
         └───┤ error   │     │authenticated│┘
             └─────────┘     └────┬────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
              API 请求成功    收到 401      logout()
                    │             │             │
                    │             ▼             │
                    │      ┌─────────────┐      │
                    │      │  refreshing │      │
                    │      └──────┬──────┘      │
                    │             │             │
                    │      ┌──────┴──────┐      │
                    │      ▼             ▼      │
                    │ ┌─────────┐   ┌─────────┐ │
                    └─┤ success │   │  error  ├─┘
                      │(重试原请求)│   │(跳转登录)│
                      └─────────┘   └─────────┘
```

---

## 4. 正常流程

### 4.1 登录流程

```
用户在前端登录页输入邮箱+密码
  │
  ▼
调用 authStore.login({ email, password })
  │
  ▼
POST /api/auth/login（不携带 Authorization）
  │
  ▼
后端验证成功，返回 { data: { user, accessToken, refreshToken } }
  │
  ▼
authStore 解析响应：
  - accessToken = data.accessToken
  - refreshToken = data.refreshToken
  - user = data.user
  - 写入 localStorage
  │
  ▼
状态变为 authenticated
  │
  ▼
isAuthenticated = true
  │
  ▼
后续所有 API 请求自动携带 Authorization: Bearer <accessToken>
```

### 4.2 发起认证请求流程

```
Store 调用 api.get<T>('/sessions')
  │
  ▼
请求拦截器执行：
  - 读取 authStore.accessToken
  - 若存在，添加 header: Authorization: Bearer <token>
  │
  ▼
发起 fetch 请求
  │
  ▼
后端验证 JWT 成功，返回 { data: [...] }
  │
  ▼
响应拦截器执行（无异常）
  │
  ▼
检查 res.ok = true
  │
  ▼
解析 res.json()，提取 .data 返回给调用方
  │
  ▼
Store 拿到类型为 T 的数据
```

### 4.3 Token 自动刷新流程

```
Store 调用 api.get<T>('/sessions')
  │
  ▼
请求携带 Authorization: Bearer <expired_access_token>
  │
  ▼
后端返回 401 Unauthorized
  │
  ▼
响应拦截器捕获 401：
  │
  ▼
检查是否正在刷新？
  │
  ├─ 是 → 将当前请求加入刷新队列，等待刷新结果后重试
  │
  └─ 否 → 进入刷新状态（refreshing = true）
  │
  ▼
调用 authStore.refresh()
  │
  ▼
POST /api/auth/refresh
  body: { refreshToken: <refreshToken> }
  │
  ▼
后端验证 Refresh Token 成功
  │
  ▼
返回 { data: { accessToken, refreshToken } }
  │
  ▼
更新 authStore.accessToken 和 refreshToken
  更新 localStorage
  │
  ▼
刷新完成（refreshing = false）
  │
  ▼
重试之前失败的请求（使用新 accessToken）
  │
  ▼
队列中的其他 401 请求也使用新 Token 重试
```

---

## 5. 错误场景

### 5.1 401 → 刷新失败 → 重定向登录页

```
API 请求收到 401
  │
  ▼
触发刷新流程：POST /api/auth/refresh
  │
  ▼
后端返回 401（Refresh Token 过期/无效）
  │
  ▼
authStore.refresh() 抛出 ApiError
  │
  ▼
刷新拦截器捕获错误：
  - 清除 accessToken / refreshToken
  - 清除 localStorage
  - 设置 authStore 状态为 unauthenticated
  - 触发 api.onUnauthorized(error)
  │
  ▼
onUnauthorized 钩子执行（由 auth store 注册）：
  - 调用 logout() 清理状态
  - 重定向到 /login（通过 router.push，实际由 f-02 路由守卫处理）
  │
  ▼
原请求抛出 ApiError(401)，调用方 catch 到错误
```

### 5.2 登录失败

```
调用 authStore.login(credentials)
  │
  ▼
POST /api/auth/login
  │
  ▼
后端返回 401（密码错误）或 400（参数无效）
  │
  ▼
抛出 ApiError
  │
  ▼
authStore 状态保持 unauthenticated
  │
  ▼
登录页显示错误信息（由 f-01 处理 UI）
```

### 5.3 网络错误（与认证无关）

```
API 请求 fetch 失败（DNS/连接/CORS）
  │
  ▼
抛出 NetworkError
  │
  ▼
不触发刷新流程
  │
  ▼
直接抛给调用方处理
```

### 5.4 并发 401 处理

```
请求 A 收到 401
  │
  ▼
开始刷新（设置 isRefreshing = true）
  │
  ▼
请求 B 也收到 401
  │
  ▼
发现 isRefreshing = true
  │
  ▼
将请求 B 加入 pendingQueue（Promise 队列）
  │
  ▼
刷新成功
  │
  ▼
用新 Token 重试请求 A
  用新 Token 重试队列中的请求 B
```

---

## 6. API 客户端行为详述

### 6.1 请求拦截器（authInterceptor）

```typescript
function authInterceptor(config: RequestConfig): RequestConfig {
  const token = useAuthStore().accessToken
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    }
  }
  return config
}
```

**行为规则：**
- 每次请求前读取 `authStore.accessToken`
- 若 token 存在，注入 `Authorization: Bearer <token>`
- 若 token 为 `null`，不注入 header（允许匿名请求）
- 拦截器不修改 `credentials`（JWT 模式下不再需要 `credentials: 'include'`）

### 6.2 401 响应处理与刷新逻辑

```typescript
// 在 request<T> 函数中，收到 Response 后：
if (res.status === 401) {
  const err = await parseApiError(res)

  // 尝试刷新
  if (authStore.refreshToken) {
    try {
      await authStore.refresh()
      // 刷新成功，用新 token 重试原请求
      return request<T>(config)
    } catch {
      // 刷新失败，走 onUnauthorized
      if (client.onUnauthorized) {
        client.onUnauthorized(err)
      }
      throw err
    }
  }

  // 无 refreshToken，直接触发 onUnauthorized
  if (client.onUnauthorized) {
    client.onUnauthorized(err)
  }
  throw err
}
```

**行为规则：**
- 401 时优先尝试刷新，而非直接触发 `onUnauthorized`
- 刷新成功：递归重试原请求（使用新 Token）
- 刷新失败或无 refreshToken：触发 `onUnauthorized`，仍抛出 `ApiError`
- 防止无限递归：重试次数上限为 1（刷新后重试一次，若再 401 则不再刷新）

### 6.3 SSE 请求的特殊处理

```
api.sse('/chat', body, callbacks, options)
  │
  ▼
同样经过 authInterceptor，携带 Authorization header
  │
  ▼
SSE 连接建立
  │
  ▼
若连接建立时返回 401：
  - 尝试刷新 Token
  - 刷新成功：不自动重试 SSE（SSE 无状态难以重试），调用 onError 并携带特殊标记
  - 刷新失败：触发 onUnauthorized
```

> SSE 的 401 处理简化：由于 SSE 是流式连接，刷新后不自动重连，由调用方（session store）根据错误类型决定是否提示用户重新发送。

---

## 7. Auth Store 行为详述

### 7.1 状态定义

```typescript
interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: { id: string; email: string; name: string | null } | null
  isLoading: boolean
  error: string | null
}
```

### 7.2 计算属性

| 属性 | 逻辑 |
|------|------|
| `isAuthenticated` | `!!accessToken` |
| `isAdmin` | 预留，当前始终 `false` |

### 7.3 Actions

#### `login(credentials: LoginCredentials): Promise<void>`

```
1. isLoading = true, error = null
2. POST /api/auth/login
3. 成功：
   - accessToken = data.accessToken
   - refreshToken = data.refreshToken
   - user = data.user
   - 写入 localStorage
   - isLoading = false
4. 失败：
   - error = err.message
   - isLoading = false
   - 抛出错误
```

#### `register(credentials: RegisterCredentials): Promise<void>`

```
1. isLoading = true, error = null
2. POST /api/auth/register
3. 成功：与 login 相同，存储双 Token
4. 失败：与 login 相同
```

#### `refresh(): Promise<void>`

```
1. 检查 refreshToken 是否存在
   - 不存在 → 抛出错误
2. POST /api/auth/refresh
   body: { refreshToken }
   注意：此请求不经过 authInterceptor（不需要 Authorization）
3. 成功：
   - accessToken = data.accessToken
   - refreshToken = data.refreshToken
   - 更新 localStorage
4. 失败：
   - 清除所有 Token 和 user
   - 清除 localStorage
   - 抛出错误
```

#### `logout(): Promise<void>`

```
1. 若 accessToken 存在：
   POST /api/auth/logout
   headers: Authorization: Bearer <accessToken>
   body: { refreshToken }
2. 无论后端是否成功：
   - 清除 accessToken / refreshToken / user
   - 清除 localStorage
   - error = null
3. 不抛出错误（静默处理）
```

### 7.4 持久化

```typescript
// Store 初始化时（defineStore 的 setup 中）
const accessToken = localStorage.getItem('goferbot_access_token')
const refreshToken = localStorage.getItem('goferbot_refresh_token')
if (accessToken && refreshToken) {
  state.accessToken = accessToken
  state.refreshToken = refreshToken
  // 可选：调用 GET /api/auth/me 恢复 user 信息
}

// Token 变化时写入 localStorage
watch(accessToken, (v) => {
  if (v) localStorage.setItem('goferbot_access_token', v)
  else localStorage.removeItem('goferbot_access_token')
})
```

---

## 8. 类型定义更新

### 8.1 `api/types.ts` 新增类型

```typescript
// NestJS 统一响应格式
export interface ApiResponse<T> {
  data: T
}

// JWT Token 响应
export interface JwtTokens {
  accessToken: string
  refreshToken: string
}

// 用户信息
export interface UserDTO {
  id: string
  email: string
  name: string | null
  avatar: string | null
  createdAt: string
}

// 登录请求
export interface LoginRequest {
  email: string
  password: string
}

// 注册请求
export interface RegisterRequest {
  email: string
  password: string
  name?: string
}

// 登录/注册响应
export interface AuthResponse {
  user: UserDTO
  accessToken: string
  refreshToken: string
}

// 刷新请求
export interface RefreshRequest {
  refreshToken: string
}
```

### 8.2 现有类型调整

- `SignInRequest` → 重命名为 `LoginRequest`（或保留别名）
- `SignUpRequest` → 重命名为 `RegisterRequest`（或保留别名）
- `AuthSession` → 重命名为 `UserDTO`（或保留别名）
- 所有 DTO 类型保持向后兼容，通过 `type` 别名过渡

---

## 9. Stores 更新要点

### 9.1 `session.ts`

- 移除对旧 `AuthSession` 类型的引用
- API 调用无需修改（`api.get` / `api.post` 等接口不变）
- 响应自动解包 `data`，store 直接拿到数组/对象

### 9.2 `knowledgeBase.ts`

- `importFiles` 中的 `fetch` 调用需更新：
  - 移除 `credentials: 'include'`
  - 手动注入 `Authorization: Bearer <token>`（或通过 api 客户端的辅助方法）
- 其他 `api.*` 调用无需修改

### 9.3 `settings.ts`

- `api.get('/settings')` 和 `api.post('/settings', ...)` 无需修改
- 响应自动解包 `data`

---

## 10. 边界情况

| 场景 | 预期行为 |
|------|----------|
| localStorage 被手动清除 | 下次请求无 Token，后端返回 401，触发 onUnauthorized |
| Access Token 在请求中途过期 | 该请求 401，触发刷新，成功后重试 |
| Refresh Token 也过期 | 刷新失败，清除所有状态，触发 onUnauthorized |
| 用户打开多个标签页 | 各标签页共享 localStorage，Token 状态一致 |
| 并发多个 401 请求 | 仅执行一次刷新，其他请求排队等待 |
| 刷新请求本身 401 | 视为刷新失败，清除状态，触发 onUnauthorized |
| 后端返回非 `{ data: T }` 格式 | 按现有逻辑解析，兼容旧格式（优先取 data，否则取整体） |
| SSE 连接 401 | 尝试刷新一次，不自动重连，调用 onError |
| logout 时后端已删除 Token | 前端仍清除本地状态，不报错 |
| 注册时邮箱已存在 | 后端返回 409，authStore.error = '邮箱已注册'，抛出 ApiError |

---

## 11. 测试要点

### 11.1 API 客户端测试

- [ ] 有 token 时请求携带 `Authorization: Bearer <token>`
- [ ] 无 token 时不携带 Authorization header
- [ ] 收到 401 且有 refreshToken 时自动调用 refresh
- [ ] 刷新成功后重试原请求
- [ ] 刷新失败时触发 onUnauthorized
- [ ] 并发 401 仅刷新一次
- [ ] SSE 请求同样携带 Authorization header

### 11.2 Auth Store 测试

- [ ] login 成功存储双 Token 和 user
- [ ] login 失败设置 error 并抛出异常
- [ ] register 成功存储双 Token 和 user
- [ ] refresh 成功更新双 Token
- [ ] refresh 失败清除所有状态
- [ ] logout 清除所有状态并调用后端 logout
- [ ] 从 localStorage 恢复 Token
- [ ] isAuthenticated 计算属性正确

### 11.3 集成测试

- [ ] session store 的 API 调用在认证后正常工作
- [ ] knowledgeBase store 的 API 调用在认证后正常工作
- [ ] settings store 的 API 调用在认证后正常工作
