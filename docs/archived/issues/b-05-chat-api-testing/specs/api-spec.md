# API 规格：ChatController SSE 测试

## 端点

### POST /api/chat

挂载在 `/api/chat`，受 `JwtAuthGuard` 保护，使用 `@BypassResponse()` 绕过统一响应拦截器。

#### 认证
Bearer Token（JWT）

#### 请求
```json
{
  "message": "string (1-4000 chars)",
  "sessionId": "uuid",
  "knowledgeBaseIds": ["uuid"],        // 可选
  "config": {
    "provider": "string (min 1)",
    "model": "string (min 1)",
    "baseUrl": "string (合法 URL + SSRF 白名单)",
    "apiKey": "string (min 1)"
  }
}
```

#### SSE 流格式

响应头：
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

每个 chunk 格式：
```
data: {"chunk":"string","done":false}\n\n
```

结束标记：
```
data: {"chunk":"","done":true}\n\n
```

#### 错误场景（流内错误）

错误通过 SSE 流内传递，包含 `done: true`：
```
data: {"error":"错误描述","done":true}\n\n
```

#### 错误码

| 码 | 场景 | 传递方式 | 响应体 |
|----|------|----------|--------|
| 400 | message 为空/超过 4000 字符 | HTTP 响应（ZodValidationPipe） | `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` |
| 400 | sessionId 格式不是 UUID | HTTP 响应（ZodValidationPipe） | 同上 |
| 400 | config.baseUrl 不在白名单 | HTTP 响应（ZodValidationPipe） | `{ "error": { "code": "VALIDATION_ERROR", "message": "baseUrl 不在白名单中..." } }` |
| 400 | 会话不存在 | SSE 流内 error | `data: {"error":"会话不存在","done":true}` |
| 400 | 无权访问该会话 | SSE 流内 error | `data: {"error":"无权访问该会话","done":true}` |
| 401 | 未携带 Authorization | HTTP 响应 | `{ "error": { "code": "AUTH_ERROR", "message": "..." } }` |
| 503 | LLM API 请求失败 | SSE 流内 error | `data: {"error":"LLM 请求失败: ...","done":true}` |
| 503 | LLM 请求超时（5 分钟） | SSE 流内 error | `data: {"error":"LLM 请求超时（5 分钟）","done":true}` |

#### 消息持久化

1. 请求到达后，用户消息立即写入 `Message` 表（role: 'user'）
2. LLM 流式响应完成后，助手回复写入 `Message` 表（role: 'assistant'）
3. Session 的 `updatedAt` 在两次写入时均更新

#### 异步行为

- LLM 请求通过 `fetch()` 发起，使用 `AbortController` 控制超时
- 超时时间由环境变量 `LLM_TIMEOUT_MS` 配置（默认 300000ms）
- 客户端断开时 `reply.raw.on('close')` 触发 `abortController.abort()`
- 超时抛出 `AbortError`，转换为 `LLM_TIMEOUT` 错误

---

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| 正常 - SSE 流式输出 | `tests/issues/b-05-chat-api-testing/chat.spec.ts` | `AC-01: POST /api/chat returns SSE stream with chunks` |
| 格式 - SSE 格式验证 | `tests/issues/b-05-chat-api-testing/chat.spec.ts` | `AC-02: SSE stream has valid format (data:, done marker)` |
| 异常 - 客户端断开 | `tests/issues/b-05-chat-api-testing/chat.spec.ts` | `AC-03: handles client disconnect/abort gracefully` |
| 持久化 - 消息落库 | `tests/issues/b-05-chat-api-testing/chat.spec.ts` | `AC-04: persists user and assistant messages to database` |
| DTO - knowledgeBaseIds | `tests/issues/b-05-chat-api-testing/chat.spec.ts` | `AC-05: accepts knowledgeBaseIds in request without error` |
| E2E - 完整链路 | `tests/issues/b-05-chat-api-testing/chat.spec.ts` | `AC-06: E2E flow (create session → send message → verify stream → view history)` |
| DTO - message 为空 | `tests/issues/b-05-chat-api-testing/chat.spec.ts` | `AC-07: returns 400 when message is empty` |
| DTO - message 超长 | `tests/issues/b-05-chat-api-testing/chat.spec.ts` | `AC-08: returns 400 when message exceeds 4000 chars` |
| DTO - sessionId 格式 | `tests/issues/b-05-chat-api-testing/chat.spec.ts` | `AC-09: returns 400 when sessionId is not a valid UUID` |
| DTO - config 字段缺失 | `tests/issues/b-05-chat-api-testing/chat.spec.ts` | `AC-10: returns 400 when config fields are missing` |
| DTO - baseUrl 白名单 | `tests/issues/b-05-chat-api-testing/chat.spec.ts` | `AC-11: returns 400 when config.baseUrl is not in whitelist` |
| 认证 - 无 JWT | `tests/issues/b-05-chat-api-testing/chat.spec.ts` | `AC-12: returns 401 without valid JWT` |
| 权限 - 非所有者 | `tests/issues/b-05-chat-api-testing/chat.spec.ts` | `AC-13: returns error via SSE when user is not session owner` |
| 异常 - 会话不存在 | `tests/issues/b-05-chat-api-testing/chat.spec.ts` | `AC-14: returns error via SSE when session does not exist` |
| 异常 - LLM 错误 | `tests/issues/b-05-chat-api-testing/chat.spec.ts` | `AC-15: returns error via SSE when LLM API fails` |
| 异常 - LLM 超时 | `tests/issues/b-05-chat-api-testing/chat.spec.ts` | `AC-16: returns LLM_TIMEOUT error when LLM times out` |
| 持久化 - 空回复 | `tests/issues/b-05-chat-api-testing/chat.spec.ts` | `AC-17: persists assistant message even when LLM returns empty` |
