Status: open
Category: enhancement

## What to build

统一 **BackendTransport** 模块，将分散的 HTTP 调用、端口管理、重试逻辑、SSE 处理集中到一个深接口之后。消除 `sidecarClient.ts` 浅模块带来的测试摩擦。

端到端行为：
- **Store 调用简化**：`sessionStore.sendMessage()` 不再手动拼接 URL、处理端口、管理重试——只需调用 `backend.request('POST', '/chat', body)`，所有网络细节隐藏
- **SSE 统一**：聊天流的 SSE 连接通过 `backend.subscribe('chat', handler)` 管理，自动处理端口变更时的连接重建
- **测试改善**：Store 单元测试注入 `FakeBackendTransport`，直接返回预设 Response 对象，完全脱离 HTTP 和网络

## Acceptance criteria

- [ ] 定义 `BackendTransport` 接口：
  - `request(method, path, body?, options?): Promise<Response>` — 统一 HTTP 请求，返回原生 Response，错误处理由调用方负责
  - `subscribe(path, body, handler): Unlisten` — SSE 订阅（用于 `/chat` 流式响应），handler 接收 `(data: string, eventType?: string)`
  - `isReady(): Promise<boolean>` — 健康检查
  - `dispose(): void` — 清理监听器和未完成请求（测试/页面卸载使用）
- [ ] 实现 `HttpBackendTransport`：
  - 内部管理端口、URL 构建（`http://127.0.0.1:${port}${path}`）
  - 重试逻辑（当前 `sidecarFetch` 的 3 次重试 + 退避）
  - 超时控制
  - 持有 `Shell` 实例，监听 `onSidecarReady` / `onSidecarRestarted` 自动更新端口
  - 保守错误策略：只处理网络层重试，所有 HTTP 响应（2xx/4xx/5xx）作为 `Response` 透传，由调用方处理
- [ ] 创建 `src/backend/` 目录结构：
  ```
  src/backend/
  ├── types.ts           # BackendTransport 接口定义
  ├── http-transport.ts  # HttpBackendTransport 实现
  ├── fake-transport.ts  # FakeBackendTransport 实现
  └── index.ts           # 模块导出 + getBackend() / setBackend() 全局访问
  ```
- [ ] 将 `src/utils/sidecarClient.ts` 的功能全部移入 `HttpBackendTransport`：
  - 端口状态管理（`setSidecarPort`、`getSidecarPort`、`clearSidecarPort`）
  - `sidecarFetch` 的 fetch + 重试逻辑
  - `healthCheck` 和 `isSidecarReady`
- [ ] 替换所有 `sidecarFetch` 调用为 `backendTransport.request`：
  - `src/stores/session.ts` — 会话、消息、聊天发送
  - `src/stores/knowledgeBase.ts` — 知识库 CRUD、文件操作
  - `src/stores/settings.ts` — 配置读写
  - 其他所有调用点（搜索 `sidecarFetch` 全文）
- [ ] 替换 SSE 聊天流调用：当前直接 `fetch` + `ReadableStream` 解析改为 `backendTransport.subscribe(path, body, (data, eventType) => { ... })`
- [ ] 更新单元测试：
  - 所有 store 测试注入 `FakeBackendTransport`（返回预设 Response），不再 mock `sidecarFetch` 或 `@/utils/sidecarClient`
  - `FakeBackendTransport` 支持可编程链式预设：
    ```ts
    const backend = new FakeBackendTransport()
    backend.when('GET', '/knowledge-bases').respond(200, [{ id: '1', name: 'Test' }])
    backend.when('POST', '/chat').respondSSE([{ data: 'hello', event: '' }, { data: 'world', event: '' }])
    ```
  - `FakeBackendTransport` 记录所有请求历史，支持断言验证
- [ ] 删除 `src/utils/sidecarClient.ts`（#11 完成后彻底清除，不保留兼容层）
- [ ] 更新 `pnpm test` 和 `pnpm test:e2e` 验证全部通过

## Blocked by

- [10-shell-abstraction-and-browser-mode](../10-shell-abstraction-and-browser-mode.md) — BackendTransport 通过 Shell 接口获取端口，依赖 Shell 模块先完成

## Comments

> 本 issue 是架构重构的第二阶段，不引入新功能。目标是将浅模块 `sidecarClient.ts` 深化为具有高 leverage 的 BackendTransport 接口。
>
> 为什么 `sidecarClient.ts` 是浅模块：
> - 接口（`setSidecarPort`、`getSidecarPort`、`clearSidecarPort`、`sidecarFetch`、`healthCheck`、`isSidecarReady`）几乎与实现一样复杂
> - 调用者仍需手动管理端口、URL、重试——知识集中在调用者而非模块内
> - 测试必须 mock 整个模块，而非注入一个语义接口
>
> BackendTransport 的深度体现在：
> - 调用者只需知道 `request(method, path, body)`——端口、重试、超时、URL 构建全部隐藏
> - 变更网络行为（如添加请求拦截器、统一错误处理）只需修改一处

## Agent Brief

**Category:** enhancement
**Summary:** 统一 BackendTransport 模块，将 HTTP 通信逻辑集中到深接口之后，消除 `sidecarClient.ts` 浅模块。Store 测试注入 FakeBackendTransport，完全脱离网络。

**Current behavior:**
- `src/utils/sidecarClient.ts` 是浅模块：6 个导出函数，调用者仍需手动组合使用
- Store 文件直接调用 `sidecarFetch(path, options, retries)`，需关心端口、URL、重试次数
- SSE 聊天流在 `session.ts` 中直接 `fetch` + `ReadableStream` 解析，与 `sidecarClient` 并行存在
- Store 单元测试 mock `@/utils/sidecarClient` 模块，测试与模块路径耦合

**Desired behavior:**
- 所有后端通信通过 `BackendTransport.request()` 和 `BackendTransport.subscribe()`
- Store 代码不再出现 `http://127.0.0.1:`、`sidecarFetch`、`fetch` 等网络细节
- 单元测试注入 `FakeBackendTransport`，直接控制响应，无需 mock 模块
- 网络行为变更（重试策略、超时、请求头）集中在 `HttpBackendTransport` 一处
- 错误处理分层：`BackendTransport` 负责网络层重试，业务错误由调用方处理，未来可扩展统一错误处理函数

**Key interfaces:**
- `BackendTransport` — 前端与 Sidecar 业务后端的唯一 seam
- `HttpBackendTransport` — 真实实现，持有 `Shell` 实例，监听端口变更
- `FakeBackendTransport` — 测试适配器，可编程链式预设 + 请求记录 + SSE 模拟
- `Unlisten` — `( ) => void`，SSE 取消订阅
- 错误策略 — 保守策略：`BackendTransport` 只处理网络层重试，所有 HTTP 响应透传为 `Response`，由调用方处理业务错误

**Acceptance criteria:**
- [ ] `src/backend/` 目录结构创建，`BackendTransport` 接口定义完成
- [ ] `HttpBackendTransport` 实现：持有 Shell、端口监听、重试、SSE 解析
- [ ] `FakeBackendTransport` 实现：链式预设、请求记录、SSE 模拟
- [ ] 全局访问：`getBackend()` / `setBackend()` 模块级导出
- [ ] 所有 `sidecarFetch` 调用替换为 `backend.request()`
- [ ] SSE 聊天流替换为 `backend.subscribe(path, body, handler)`
- [ ] Store 单元测试使用 `FakeBackendTransport`，不再 mock `sidecarFetch`
- [ ] `src/utils/sidecarClient.ts` 彻底删除
- [ ] `pnpm test` 全部通过，`pnpm test:e2e` 全部通过

**Out of scope:**
- Shell 模块本身（由 #10 负责）
- Sidecar 业务逻辑变更
- 新的网络协议（如 WebSocket）
- 性能优化（如连接池、请求去重）
