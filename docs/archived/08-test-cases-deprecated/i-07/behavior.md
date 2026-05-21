---
issue_id: i-07
type: test-case
kind: behavior
tc_count: 80
status: drafted
summary: 测试前端 API 客户端全部能力：核心请求方法（get/post/patch/delete）、错误处理与错误类型分层、SSE 流解析与中断、401 自动刷新与并发安全、超时控制、自定义 headers 合并、baseURL 配置。
---

# Behavior Test Cases: API Client（i-07）

> Issue: i-07-api-client
> 日期: 2026-05-16
> 依据: docs/03-specs/i-07-api-client/feature-spec.md、behavior-spec.md

---

## 1. 核心请求方法（get / post / patch / delete）

| TC-ID | 测试项 | 前置条件 | 步骤 | 预期结果 | 优先级 |
|-------|--------|----------|------|----------|--------|
| TC-I07-001 | `api.get<T>` 返回解析后的 JSON | 后端 `/test` 返回 `{"id":"1"}` | 调用 `api.get<{id:string}>('/test')` | 返回 `{id:'1'}`，类型推断为 `T` | P0 |
| TC-I07-002 | `api.post<T>` 发送 JSON body | 后端 `/test` 接收并回显 body | 调用 `api.post('/test', {name:'foo'})` | fetch 的 body 为 `'{"name":"foo"}'`，返回解析后的 JSON | P0 |
| TC-I07-003 | `api.patch<T>` 发送部分更新 | 后端 `/test` 接收 PATCH body | 调用 `api.patch('/test', {status:'active'})` | HTTP 方法为 PATCH，body 正确序列化，返回解析后的 JSON | P0 |
| TC-I07-004 | `api.delete` 返回 void | 后端 `/test` 返回 204 | 调用 `api.delete('/test')` | 返回 `undefined`，不解析响应体 | P0 |
| TC-I07-005 | `api.delete` 后端返回 200 带 body | 后端 `/test` 返回 200 及 body | 调用 `api.delete('/test')` | 仍返回 `undefined`，忽略 body | P1 |
| TC-I07-006 | 自动携带 `credentials: 'include'` | 任意请求 | 调用任意 `api.get/post/patch/delete` | fetch init 包含 `credentials: 'include'` | P0 |
| TC-I07-007 | 自动添加 `Content-Type: application/json` | 任意请求 | 调用任意 `api.get/post/patch/delete` | fetch headers 包含 `Content-Type: application/json` | P0 |
| TC-I07-008 | 基础 URL 读取环境变量 | `import.meta.env.VITE_API_BASE_URL` 设为 `http://api.example.com` | 调用 `api.get('/test')` | fetch URL 为 `http://api.example.com/test` | P1 |
| TC-I07-009 | 基础 URL 使用默认值 | `VITE_API_BASE_URL` 未定义 | 调用 `api.get('/test')` | fetch URL 为 `http://localhost:3000/test` | P1 |
| TC-I07-010 | GET 请求不发送 body | 调用 `api.get('/test')` | 检查 fetch init | init 中无 `body` 字段 | P1 |
| TC-I07-011 | 自定义 headers 合并 | 调用时传入 `{headers: {'X-Custom':'foo'}}` | 执行请求 | 最终 headers 同时包含 `Content-Type` 和 `X-Custom` | P1 |
| TC-I07-012 | 后端返回 204 No Content（GET） | 后端 `/test` 返回 204 | 调用 `api.get('/test')` | 返回 `undefined`，不抛异常 | P1 |
| TC-I07-013 | 后端返回非 JSON（如 HTML 404） | 后端 `/test` 返回 404 HTML | 调用 `api.get('/test')` | 抛出 `ApiError`，`raw` 保留 HTML 文本，`message` 使用 `statusText` | P1 |

---

## 2. 错误处理

| TC-ID | 测试项 | 前置条件 | 步骤 | 预期结果 | 优先级 |
|-------|--------|----------|------|----------|--------|
| TC-I07-014 | HTTP 4xx 抛出 `ApiError` | 后端返回 400，body 为 `{"error":"Invalid input"}` | 调用 `api.get('/test')` | 抛出 `ApiError`，`status=400`，`code='HTTP_400'`，`message='Invalid input'` | P0 |
| TC-I07-015 | HTTP 5xx 抛出 `ApiError` | 后端返回 500，body 为 `{"error":"Internal error"}` | 调用 `api.get('/test')` | 抛出 `ApiError`，`status=500`，`code='HTTP_500'`，`message='Internal error'` | P0 |
| TC-I07-016 | `ApiError` 优先使用后端 `code` 字段 | 后端返回 403，body 为 `{"code":"FORBIDDEN","message":"No access"}` | 调用 `api.get('/test')` | `code='FORBIDDEN'`，`message='No access'` | P1 |
| TC-I07-017 | `ApiError` 解析失败回退 `statusText` | 后端返回 404，body 为非法 JSON | 调用 `api.get('/test')` | `message` 使用 `statusText`，`raw` 保留原始文本 | P1 |
| TC-I07-018 | 网络错误抛出 `NetworkError` | 模拟 fetch 抛出 `TypeError: Failed to fetch` | 调用 `api.get('/test')` | 抛出 `NetworkError`，`message` 包含原始错误信息 | P0 |
| TC-I07-019 | DNS 解析失败触发 `NetworkError` | 基础 URL 指向不存在的域名 | 调用 `api.get('/test')` | 抛出 `NetworkError` | P1 |
| TC-I07-020 | CORS 拦截触发 `NetworkError` | 后端未配置 CORS | 调用 `api.get('/test')` | 抛出 `NetworkError` | P1 |
| TC-I07-021 | 全局 401 拦截钩子触发 | 已注册 `api.onUnauthorized = handler`；后端返回 401 | 调用 `api.get('/test')` | `handler` 被调用一次，且仍抛出 `ApiError` | P0 |
| TC-I07-022 | 未注册 401 钩子直接抛出 `ApiError` | `api.onUnauthorized` 为 `null`；后端返回 401 | 调用 `api.get('/test')` | 直接抛出 `ApiError`，不触发额外操作 | P1 |
| TC-I07-023 | `ApiError` 包含 `raw` 字段 | 后端返回 422，body 为 `{"details":["field required"]}` | 调用 `api.get('/test')` | `ApiError.raw` 等于原始 body 对象 | P1 |
| TC-I07-024 | 错误类型层级正确 | 捕获 `ApiError` / `NetworkError` | 使用 `instanceof ApiClientError` 检查 | 两者均为 `ApiClientError` 的实例 | P1 |

---

## 3. 超时与取消

| TC-ID | 测试项 | 前置条件 | 步骤 | 预期结果 | 优先级 |
|-------|--------|----------|------|----------|--------|
| TC-I07-025 | 默认超时 30s 触发 `NetworkError` | fetch 挂起不返回 | 调用 `api.get('/test')`，不指定 timeout | 30s 后抛出 `NetworkError`，`message='Request timeout'` | P0 |
| TC-I07-026 | 自定义 timeout 覆盖默认值 | fetch 挂起 | 调用 `api.get('/test', {timeout: 1000})` | 1s 后抛出 `NetworkError` | P0 |
| TC-I07-027 | 请求正常完成不触发超时 | fetch 在 1s 内返回 | 调用 `api.get('/test', {timeout: 5000})` | 正常返回结果，不抛超时错误 | P1 |
| TC-I07-028 | 手动 AbortController 取消请求 | 创建 `AbortController`，传入 `signal` | 在请求完成前调用 `controller.abort()` | 抛出 `NetworkError`，`message` 包含 abort 信息 | P1 |
| TC-I07-029 | 超时 signal 与外部 signal 合并 | 同时传入 `timeout: 1000` 和外部 `signal` | 外部 signal 先 abort | 优先响应任一 abort 事件，抛出 `NetworkError` | P1 |
| TC-I07-030 | abort 已完成的请求无影响 | 请求已返回 200 | 对已完成的请求调用 `controller.abort()` | 无异常，结果不受影响 | P2 |

---

## 4. SSE 流式请求

| TC-ID | 测试项 | 前置条件 | 步骤 | 预期结果 | 优先级 |
|-------|--------|----------|------|----------|--------|
| TC-I07-031 | SSE 解析 `data:` 行并触发 `onChunk` | 后端 SSE 流发送 `data: {"chunk":"hello"}\n\n` | 调用 `api.sse('/chat', body, callbacks)` | `onChunk` 被调用，参数为 `{chunk:'hello'}` | P0 |
| TC-I07-032 | SSE 多行数据顺序正确 | 后端发送多行 `data:` | 调用 `api.sse` | `onChunk` 按发送顺序依次调用 | P0 |
| TC-I07-033 | SSE 流结束触发 `onDone` | 后端正常关闭连接 | 调用 `api.sse` | 所有数据接收完毕后调用 `onDone()` | P0 |
| TC-I07-034 | SSE 使用 POST 方法 | 任意 SSE 调用 | 检查 fetch init | `method: 'POST'` | P1 |
| TC-I07-035 | SSE 自动添加 `Accept: text/event-stream` | 任意 SSE 调用 | 检查 fetch headers | headers 包含 `Accept: text/event-stream` | P1 |
| TC-I07-036 | SSE 携带 `credentials: 'include'` | 任意 SSE 调用 | 检查 fetch init | `credentials: 'include'` | P1 |
| TC-I07-037 | SSE 支持 AbortController 取消 | 创建 `AbortController` 传入 SSE | 调用 `controller.abort()` | reader 释放，触发 `onError(NetworkError('Aborted'))` | P0 |
| TC-I07-038 | SSE 默认超时 5min | SSE 连接挂起 | 调用 `api.sse` 不指定 timeout | 5 分钟后触发 `onError(NetworkError('Request timeout'))` | P1 |
| TC-I07-039 | SSE 收到 `event: error` 触发 `onError` | 后端发送 `event: error\ndata: {...}` | 调用 `api.sse` | 触发 `onError` 并结束流 | P1 |
| TC-I07-040 | SSE 收到非 JSON 的 data 行 | 后端发送 `data: not-json` | 调用 `api.sse` | 触发 `onError`，携带原始字符串和解析错误信息 | P1 |
| TC-I07-041 | SSE 响应非 2xx 触发 `onError` | 后端返回 403 | 调用 `api.sse` | 直接触发 `onError(ApiError)`，不进入流读取 | P0 |
| TC-I07-042 | SSE 网络失败触发 `onError` | fetch 抛出网络错误 | 调用 `api.sse` | 触发 `onError(NetworkError)` | P0 |
| TC-I07-043 | SSE 响应无 body 触发 `onError` | 后端返回 200 但 body 为 null | 调用 `api.sse` | 触发 `onError(NetworkError('SSE response has no body'))` | P1 |
| TC-I07-044 | SSE buffer 跨 chunk 保留不完整行 | 第一个 chunk 包含 `data: {"ch` | 继续发送 `unk":"hi"}\n\n` | 正确拼接后解析并触发一次 `onChunk` | P1 |
| TC-I07-045 | SSE 忽略 `id:` 和 `retry:` 字段 | 后端发送 `id: 123\nretry: 5000\ndata: {}\n\n` | 调用 `api.sse` | 仅处理 `data:` 行，忽略其他字段 | P2 |
| TC-I07-046 | SSE 读取异常触发 `onError` | reader.read() 抛出异常 | 调用 `api.sse` | 触发 `onError(NetworkError('SSE read error'))` | P1 |

---

## 5. 拦截器

| TC-ID | 测试项 | 前置条件 | 步骤 | 预期结果 | 优先级 |
|-------|--------|----------|------|----------|--------|
| TC-I07-047 | 请求拦截器按注册顺序执行 | 注册两个拦截器 A、B | 调用 `api.get('/test')` | A 先执行，B 后执行 | P1 |
| TC-I07-048 | 请求拦截器可修改 headers | 注册拦截器添加 `X-Auth: token` | 调用 `api.get('/test')` | 最终请求 headers 包含 `X-Auth: token` | P0 |
| TC-I07-049 | 请求拦截器可修改 url | 注册拦截器将 path 改为 `/v2/test` | 调用 `api.get('/test')` | fetch URL 为 `.../v2/test` | P1 |
| TC-I07-050 | 请求拦截器可修改 timeout | 注册拦截器设置 `timeout: 5000` | 调用 `api.get('/test')` | 超时时间为 5s | P1 |
| TC-I07-051 | 请求拦截器抛出异常转为 `NetworkError` | 注册拦截器抛出 `Error('fail')` | 调用 `api.get('/test')` | 抛出 `NetworkError`，message 包含 `Request interceptor failed` | P1 |
| TC-I07-052 | 响应拦截器按注册顺序执行 | 注册两个拦截器 C、D | 调用 `api.get('/test')` | C 先执行，D 后执行 | P1 |
| TC-I07-053 | 响应拦截器可修改 response | 注册拦截器将 `res.ok` 改为 `true` | 后端返回 500 | 拦截后 `res.ok` 为 true，不抛 `ApiError` | P1 |
| TC-I07-054 | 响应拦截器抛出异常转为 `NetworkError` | 注册拦截器抛出 `Error('fail')` | 调用 `api.get('/test')` | 抛出 `NetworkError`，message 包含 `Response interceptor failed` | P1 |
| TC-I07-055 | 拦截器修改 headers 为 undefined 时过滤 | 注册拦截器设置 `headers: {foo: undefined}` | 调用 `api.get('/test')` | 最终 headers 中无 `foo` 键 | P2 |

---

## 6. 类型安全

| TC-ID | 测试项 | 前置条件 | 步骤 | 预期结果 | 优先级 |
|-------|--------|----------|------|----------|--------|
| TC-I07-056 | `api.get<T>` 返回类型为 `T` | 定义接口 `TestDTO {id:string}` | 调用 `api.get<TestDTO>('/test')` | TypeScript 推断返回值为 `TestDTO`，无需 `as` 强转 | P0 |
| TC-I07-057 | `api.post<T>` 返回类型为 `T` | 定义接口 `CreateRes {created:boolean}` | 调用 `api.post<CreateRes>('/test', {})` | TypeScript 推断返回值为 `CreateRes` | P0 |
| TC-I07-058 | `api.delete` 返回类型为 `void` | 任意调用 | `const r = await api.delete('/test')` | `r` 类型为 `void` | P0 |
| TC-I07-059 | `api.sse` 的 `onChunk` 参数类型为 `T` | 定义接口 `Chunk {content:string}` | 调用 `api.sse<Chunk>(...)` | `onChunk` 参数类型推断为 `Chunk` | P0 |
| TC-I07-060 | DTO 类型与后端同步 | `types.ts` 中定义 `KnowledgeBaseDTO` | 在 store 中使用 `api.get<KnowledgeBaseDTO[]>` | 类型定义与后端返回结构一致 | P1 |

---

## 7. 边界条件与并发

| TC-ID | 测试项 | 前置条件 | 步骤 | 预期结果 | 优先级 |
|-------|--------|----------|------|----------|--------|
| TC-I07-061 | 空 path（`''`）请求基础 URL | `baseURL` 为 `http://localhost:3000` | 调用 `api.get('')` | fetch URL 为 `http://localhost:3000` | P2 |
| TC-I07-062 | path 以 `/` 开头与拼接正确 | `baseURL` 为 `http://localhost:3000` | 调用 `api.get('/test')` | fetch URL 为 `http://localhost:3000/test`（无双斜杠） | P2 |
| TC-I07-063 | 空 body POST | 调用 `api.post('/test', undefined)` | 检查 fetch init | body 为 `undefined`，不发送 `undefined` 字符串 | P2 |
| TC-I07-064 | 并发请求独立超时 | 同时发起两个请求，timeout 分别为 1s 和 5s | 等待执行 | 1s 的请求先超时，5s 的请求继续直到完成或超时 | P1 |
| TC-I07-065 | 同一 `AbortController` 用于多个请求 | 同一 signal 传给两个 `api.get` | 调用 `controller.abort()` | 两个请求均被取消 | P2 |
| TC-I07-066 | 环境变量 `VITE_API_BASE_URL` 为空字符串 | `VITE_API_BASE_URL=''` | 调用 `api.get('/test')` | 使用默认值 `http://localhost:3000`（空字符串视为 falsy） | P2 |

---

## 8. 回归测试（迁移验证）

| TC-ID | 测试项 | 前置条件 | 步骤 | 预期结果 | 优先级 |
|-------|--------|----------|------|----------|--------|
| TC-I07-067 | `settings.ts` store 调用 `api.get` 正常 | 后端 `/settings` 返回配置对象 | 触发 settings 加载 | 配置正确加载，无类型错误 | P0 |
| TC-I07-068 | `knowledgeBase.ts` store 调用 `api.post` 正常 | 后端 `/knowledge-bases` 创建成功 | 触发创建知识库 | 知识库创建成功，返回类型正确 | P0 |
| TC-I07-069 | `knowledgeBase.ts` store 调用 `api.delete` 正常 | 后端删除接口返回 204 | 触发删除知识库 | 删除成功，无异常 | P0 |
| TC-I07-070 | `session.ts` store 调用 `api.sse` 正常 | 后端 `/chat` SSE 正常流式返回 | 发送聊天消息 | 消息流式显示，`onChunk` / `onDone` 正常触发 | P0 |
| TC-I07-071 | `MoveCopyDialog.vue` 调用 `api.get` 正常 | 后端文件列表接口返回数据 | 打开移动/复制对话框 | 目标文件列表正确加载 | P0 |
| TC-I07-072 | 全局无残留 `apiRequest` / `apiSubscribe` 引用 | 源码中已替换所有调用 | 搜索 `packages/webui/src` | grep 结果为空 | P0 |

---

## 测试执行汇总

| 类别 | 用例数 | P0 | P1 | P2 |
|------|--------|----|----|----|
| 核心请求方法 | 13 | 4 | 8 | 1 |
| 错误处理 | 11 | 4 | 7 | 0 |
| 超时与取消 | 6 | 3 | 2 | 1 |
| SSE 流式请求 | 16 | 6 | 9 | 1 |
| 拦截器 | 9 | 2 | 6 | 1 |
| 类型安全 | 5 | 4 | 1 | 0 |
| 边界条件与并发 | 6 | 0 | 2 | 4 |
| 回归测试（迁移验证） | 6 | 6 | 0 | 0 |
| **合计** | **72** | **29** | **35** | **8** |

---

## 备注

- 所有 P0 用例必须在代码合并前 100% 通过。
- P1 用例在合并前通过率达到 90% 以上。
- P2 用例为边界与防御性测试，可在后续迭代补充。
- SSE 测试需使用 `ReadableStream` + `TextEncoder` 模拟后端流。
- 超时测试建议使用 `vi.useFakeTimers()`（Vitest）避免真实等待。
