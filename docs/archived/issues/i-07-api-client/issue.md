---
id: i-07-api-client
type: issue
status: closed
track: infra
priority: p1
summary: 将当前临时实现的 API 客户端升级为标准化、类型安全的 API 客户端，统一前后端通信契约。提供类型安全、统一错误处理、SSE 支持。
blocked_by: [i-09-nestjs-auth-system, b-04-chat-sse-api]
blocks: []
spec: docs/03-specs/i-07-api-client/
plan: docs/04-plans/i-07-api-client/v1.md
tests: docs/08-test-cases/i-07-api-client/
token_estimate: 1200
---

状态: needs-triage
分类: enhancement

## 要构建的内容

将当前临时实现的 `api/client.ts` 升级为标准化、类型安全的 API 客户端，统一前后端通信契约。

## 背景

架构改革中已删除 `shellAdapters` 和 `backendAdapters` 包，前端改用直接 HTTP 通信。当前 `packages/webui/src/api/client.ts` 是临时实现：
- `apiRequest` 返回裸 `Response`，每个 store 需要自己 `await res.json()`
- 无类型安全，DTO 结构与后端可能脱节
- SSE 解析逻辑硬编码，与后端事件格式耦合
- 无统一错误处理、重试、请求取消机制

## 规格引用

- PRD: docs/01-prd/v2-cloud-native.md
- ADR: docs/adrs/0004-cloud-native-rearchitecture.md

## 验收标准

### 核心请求方法
- [ ] `api.get<T>(path)` / `api.post<T>(path, body)` / `api.patch<T>(path, body)` / `api.delete(path)` — 泛型返回解析后的 JSON
- [ ] 自动携带 `credentials: 'include'`（支持 Session Cookie）
- [ ] 自动添加 `Content-Type: application/json`
- [ ] 基础 URL 从 `import.meta.env.VITE_API_BASE_URL` 读取，默认 `http://localhost:3000`

### 错误处理
- [ ] HTTP 错误（4xx/5xx）统一抛出 `ApiError`，包含 `status`、`code`、`message`
- [ ] 网络错误（fetch 失败）抛出 `NetworkError`
- [ ] 提供全局错误拦截钩子（供 auth store 处理 401 跳转登录页）

### SSE 流式请求
- [ ] `api.sse(path, body, onChunk)` — 专门处理 `/chat` SSE 端点
- [ ] 支持 AbortController 取消请求
- [ ] 解析后端 SSE 格式（`data: {...}`），自动 JSON.parse
- [ ] 流结束或错误时正确触发回调

### 类型安全
- [ ] 与后端共享 DTO 类型（考虑使用 Hono RPC 或手动同步）
- [ ] 所有 API 方法返回类型明确，不在 store 中 `as` 强转

### 扩展性
- [ ] 支持请求/响应拦截器（预留 auth token、日志、性能监控）
- [ ] 支持请求超时配置

## 阻塞于

- b-01-auth-api（需要确定认证机制：Session Cookie vs Token，影响 credentials 和 401 处理）
- b-04-chat-sse-api（需要确定 SSE 响应格式，影响 `api.sse` 解析逻辑）

## 范围外

- 完整的 Hono RPC 客户端（若后端启用 Hono RPC 可后续升级）
- 请求缓存层
- 离线队列（断网重连）

## Agent 简报

**分类：** enhancement
**摘要：** 标准化前端 API 客户端，替代临时 `api/client.ts`，提供类型安全、统一错误处理、SSE 支持

**当前行为：**
`api/client.ts` 是临时实现，无类型安全，错误处理分散在各 store 中。

**期望行为：**
所有前端 HTTP 通信通过统一客户端，类型安全、错误处理集中、SSE 解析标准化。

**关键接口：**
- `packages/webui/src/api/client.ts` — 升级后的 API 客户端
- `packages/webui/src/api/errors.ts` — 错误类型定义
- `packages/webui/src/api/types.ts` — 共享 DTO 类型

**验收标准：**
- [ ] 泛型请求方法（get/post/patch/delete）
- [ ] 自动 credentials / Content-Type
- [ ] 统一错误类型（ApiError / NetworkError）
- [ ] 全局 401 拦截钩子
- [ ] SSE 专用方法（支持取消）
- [ ] 类型安全（无 `as` 强转）
- [ ] 拦截器/超时扩展性

**范围外：**
- Hono RPC 完整集成
- 请求缓存
- 离线队列
