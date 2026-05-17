---
issue_id: i-07-api-client
type: behavior-spec
status: approved
summary: 定义标准请求生命周期（合并配置→拦截器链→fetch→响应处理→错误分类）和 SSE 连接生命周期（建立→解析事件→自动重连→close），含 401 自动刷新/跳转逻辑。
---
# Behavior Spec: API Client（请求生命周期与错误处理）

> Issue: i-07-api-client
> 状态: draft
> 日期: 2026-05-16

---

## 1. 请求生命周期

### 1.1 标准请求流程（get / post / patch / delete）

```
调用 api.get<T>(path, options)
  │
  ▼
合并默认配置 + 用户 options
  │
  ▼
执行请求拦截器链（修改 headers / url / body）
  │
  ▼
构造 fetch RequestInit
  - method: GET/POST/PATCH/DELETE
  - headers: { 'Content-Type': 'application/json', ...customHeaders }
  - credentials: 'include'
  - body: JSON.stringify(body)（仅 POST/PATCH）
  - signal: AbortSignal（若配置了 timeout）
  │
  ▼
执行 fetch(url, init)
  │
  ├─ 网络失败（DNS/连接/超时） ──► 抛出 NetworkError
  │
  ▼
接收 Response
  │
  ▼
执行响应拦截器链
  │
  ▼
检查 res.ok
  │
  ├─ false（4xx/5xx） ──► 解析错误体 ──► 抛出 ApiError
  │
  ▼
解析 res.json() ──► 类型断言为 T ──► 返回 T
```

### 1.2 DELETE 请求特殊行为
- `api.delete` 不解析响应体，返回 `Promise<void>`
- 若后端返回 204 No Content，直接 resolve
- 若后端返回 200 带 body，仍忽略 body，resolve

### 1.3 超时行为
- 默认超时：30000ms（30 秒）
- 可通过 `options.timeout` 覆盖
- 超时实现：使用 `AbortController` + `setTimeout`，超时后调用 `controller.abort()`
- 超时触发 `NetworkError`，`message = 'Request timeout'`

---

## 2. 错误处理

### 2.1 错误类型层级

```
ApiClientError（抽象基类）
  ├── ApiError          # HTTP 层错误（4xx/5xx）
  └── NetworkError      # 传输层错误（fetch 失败、超时、CORS）
```

### 2.2 ApiError

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | `number` | HTTP 状态码 |
| `code` | `string` | 后端错误码（如 `UNAUTHORIZED`）或状态码字符串 |
| `message` | `string` | 可读错误信息 |
| `raw` | `unknown` | 原始响应体（解析失败时保留） |

**构造规则：**
1. 优先解析后端 JSON：`{ error: string }` → `message = error`
2. 若解析失败，使用 `res.statusText`
3. `code` 规则：后端提供 `code` 字段则用之，否则使用 `HTTP_${status}`

### 2.3 NetworkError

| 字段 | 类型 | 说明 |
|------|------|------|
| `message` | `string` | 错误描述 |
| `cause` | `unknown` | 原始错误对象 |

**触发场景：**
- DNS 解析失败
- TCP 连接失败
- 请求被 CORS 拦截
- `AbortController` 触发（超时或手动取消）
- 任何 `fetch` 抛出异常的情况

### 2.4 全局 401 拦截

```
任何请求收到 401
  │
  ▼
构造 ApiError 之前
  │
  ▼
检查是否注册了 onUnauthorized 钩子
  │
  ├─ 已注册 ──► 调用钩子（传入当前请求信息） ──► 仍抛出 ApiError
  │
  └─ 未注册 ──► 直接抛出 ApiError
```

- 钩子签名：`onUnauthorized?: (error: ApiError) => void`
- 钩子由 auth store 在应用初始化时注册
- 钩子内部执行：清除本地用户状态、跳转 `/login`
- **注意**：钩子执行后仍抛出 `ApiError`，以便调用方知晓请求失败

---

## 3. SSE 流状态机

### 3.1 SSE 请求生命周期

```
调用 api.sse(path, body, { onChunk, onError, onDone }, options)
  │
  ▼
构造 POST 请求（SSE 端点使用 POST）
  - headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' }
  - credentials: 'include'
  - body: JSON.stringify(body)
  - signal: AbortSignal（来自 options.signal 或内部 AbortController）
  │
  ▼
执行 fetch
  │
  ├─ 网络失败 ──► 调用 onError(NetworkError) ──► 结束
  │
  ▼
检查 res.ok
  │
  ├─ false ──► 读取错误体 ──► 调用 onError(ApiError) ──► 结束
  │
  ▼
获取 res.body.getReader()
  │
  ▼
循环读取 chunks
  │
  ▼
按行解析 SSE 格式
  │
  ├─ 行以 `data: ` 开头 ──► JSON.parse(内容) ──► 调用 onChunk(parsed)
  │
  ├─ 行以 `event: error` 开头 ──► 调用 onError(ApiError({...}))
  │
  ├─ 读取 done === true ──► 调用 onDone() ──► 结束
  │
  └─ signal aborted ──► 调用 onError(NetworkError('Aborted')) ──► 结束
```

### 3.2 SSE 解析规则

- 缓冲区机制：使用 `TextDecoder` 流式解码，按 `\n` 分割行
- 未完整行保留在 buffer 中，等待下一 chunk
- 只处理 `data:` 和 `event:` 字段，其他字段（`id:`, `retry:`）忽略
- `data:` 内容自动 `JSON.parse`，解析失败时调用 `onError` 并携带原始字符串

### 3.3 SSE 结束标记

后端 SSE 流结束方式：
1. 正常结束：发送 `data: {"done": true}`，随后关闭连接
2. 连接关闭：reader 读到 `done: true`，触发 `onDone()`
3. 错误事件：发送 `event: error\ndata: {...}`，触发 `onError()`

### 3.4 SSE 取消机制

```typescript
const controller = new AbortController()
api.sse('/api/chat', body, callbacks, { signal: controller.signal })

// 用户点击停止按钮
controller.abort()
```

- 取消后：reader 释放、连接关闭、触发 `onError(NetworkError('Aborted'))`
- 取消不是错误态，但当前行为统一走 `onError` 通知调用方流已终止

---

## 4. 拦截器行为

### 4.1 请求拦截器

```typescript
type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>
```

- 按注册顺序依次执行
- 可修改 `url`、`headers`、`body`、`timeout`
- 若拦截器抛出异常，直接转为 `NetworkError` 抛出

### 4.2 响应拦截器

```typescript
type ResponseInterceptor = (response: Response, config: RequestConfig) => Response | Promise<Response>
```

- 按注册顺序依次执行
- 在检查 `res.ok` 之前执行，因此拦截器可修改响应使其通过
- 若拦截器抛出异常，按错误处理流程处理

---

## 5. 并发与竞态

- 本客户端不处理请求去重或竞态（由调用方 store 控制）
- 同一 `AbortController` 可被多次用于取消不同请求（不推荐）
- 超时 `AbortController` 与外部传入的 `signal` 需合并：优先响应任一 abort 事件

---

## 6. 边界情况

| 场景 | 预期行为 |
|------|----------|
| 后端返回非 JSON（如 HTML 404） | `ApiError`，`raw` 保留文本，`message` 使用 `statusText` |
| 后端返回空 body（204） | `api.get` 解析 `res.json()` 会抛异常，需特殊处理：204 时返回 `undefined as T` |
| `VITE_API_BASE_URL` 未定义 | 使用默认值 `http://localhost:3000` |
| 拦截器修改 headers 为 undefined | 合并时过滤掉 undefined 值 |
| SSE 收到非 JSON 的 data 行 | 调用 `onError`，携带原始字符串和解析错误 |
| 手动 abort 已完成的请求 | 无影响（fetch 已结束） |
