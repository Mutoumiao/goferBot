# Feature Spec: API Client（标准化前端 HTTP 客户端）

> Issue: i-07-api-client
> 状态: draft
> 日期: 2026-05-16

---

## 1. 目标

将 `packages/webui/src/api/client.ts` 从临时实现升级为标准化、类型安全的 API 客户端，统一前后端 HTTP 通信契约。

---

## 2. 背景与动机

当前 `client.ts` 存在以下问题：
- 返回裸 `Response`，每个 store 需自行 `await res.json()` 并做类型断言
- 无统一错误处理，HTTP 错误与网络错误混用原生 `Error`
- SSE 解析逻辑硬编码，与后端事件格式耦合
- 无请求取消、超时、拦截器等扩展机制

---

## 3. 功能范围

### 3.1 核心请求方法
- `api.get<T>(path, options?)` — GET 请求，返回解析后的 JSON（类型 `T`）
- `api.post<T>(path, body, options?)` — POST 请求
- `api.patch<T>(path, body, options?)` — PATCH 请求
- `api.delete(path, options?)` — DELETE 请求，返回 `void`

### 3.2 错误处理
- HTTP 错误（4xx/5xx）统一抛出 `ApiError`，包含 `status`、`code`、`message`
- 网络错误（fetch 失败、超时）抛出 `NetworkError`
- 全局 401 拦截钩子：触发后由 auth store 执行跳转登录页

### 3.3 SSE 流式请求
- `api.sse(path, body, callbacks, options?)` — 专门处理 SSE 端点（如 `/api/chat`）
- 支持 `AbortController` 取消请求
- 解析后端 SSE 格式（`data: {...}`），自动 `JSON.parse`
- 流结束或错误时正确触发回调

### 3.4 扩展机制
- 请求/响应拦截器（预留 auth token、日志、性能监控）
- 请求超时配置（默认 30s，SSE 默认 5min）

### 3.5 类型安全
- 所有方法支持泛型 `T`，返回明确类型
- DTO 类型与后端手动同步（当前阶段不使用 Hono RPC）

---

## 4. 非功能需求

- 认证机制使用 Session Cookie，所有请求自动携带 `credentials: 'include'`
- 基础 URL 从 `import.meta.env.VITE_API_BASE_URL` 读取，默认 `http://localhost:3000`
- 自动添加 `Content-Type: application/json`
- 超时后自动取消 fetch 请求

---

## 5. 范围外

- 完整的 Hono RPC 客户端（后续后端启用 Hono RPC 时可升级）
- 请求缓存层
- 离线队列（断网重连）
- 自动重试机制

---

## 6. 验收标准

- [ ] `api.get<T>` / `api.post<T>` / `api.patch<T>` / `api.delete` 泛型方法可用
- [ ] 自动携带 `credentials: 'include'` 和 `Content-Type: application/json`
- [ ] 基础 URL 正确读取环境变量并支持默认值
- [ ] HTTP 错误抛出 `ApiError`，网络错误抛出 `NetworkError`
- [ ] 全局 401 拦截钩子可注册并触发
- [ ] `api.sse` 支持 `AbortController`、正确解析 `data: {...}`、流结束/错误回调
- [ ] 拦截器支持请求/响应钩子
- [ ] 超时配置生效
- [ ] 所有 API 方法返回类型明确，store 中无 `as` 强转

---

## 7. 关键文件

| 文件 | 说明 |
|------|------|
| `packages/webui/src/api/client.ts` | 升级后的 API 客户端 |
| `packages/webui/src/api/errors.ts` | 错误类型定义 |
| `packages/webui/src/api/types.ts` | 共享 DTO 类型（或从后端同步） |
