# 功能规格：ChatController SSE 测试

## 测试范围

对 ChatController 的 `POST /api/chat` SSE 流式端点进行模块级集成测试，验证流式响应格式、客户端断开处理、消息持久化和 RAG 上下文传递。

## 边界

**范围内：**
- 模块级集成测试：SSE 流式响应的正常流输出
- SSE 格式验证：`data:` 行格式、`done` 标记、JSON 结构
- 客户端断开/abort 时的资源清理（AbortController）
- 消息持久化：用户消息和助手回复均写入数据库
- RAG 上下文传递：`knowledgeBaseIds` 参数被接受（RAG 检索尚未实现，phase-5 待接入）
- E2E 完整链路：创建会话 → 发消息 → 验证流 → 查看历史
- DTO 校验：message 为空/超长、sessionId 格式错误、config 字段缺失
- 认证：无 JWT 返回 401
- 权限：非会话所有者访问返回错误（通过 SSE 流内 error 传递）

**范围外：**
- LLM 实际调用（使用 nock mock 外部 API）
- Embedding/Vector 检索（使用现有 VectorService mock）
- 前端 SSE 消费（EventSource/ReadableStream）
- Session CRUD 测试（由 b-06 覆盖）
- 真实 Milvus/Redis/MinIO 依赖

## 涉及模块

- `ChatController` — SSE 端点、BypassResponse、客户端断开监听
- `ChatService` — LLM 调用、消息持久化、会话所有权校验
- `ChatDto` — Zod 校验（message/sessionId/knowledgeBaseIds/config）
- `SessionController` — 会话创建（E2E 链路依赖）

## 外部依赖 Mock

| 依赖 | Mock 方式 | 说明 |
|------|-----------|------|
| LLM API (OpenAI-compatible) | nock | 拦截 `config.baseUrl/v1/chat/completions`，返回固定 SSE 流 |
| QueueService | TestAppFactory 内置 mock | 无需额外配置 |
| VectorService | TestAppFactory 内置 mock | RAG 检索返回空 |
| StorageService | TestAppFactory 内置 mock | 无需额外配置 |

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 使用 nock mock LLM API | Fastify inject() 无法真正发起 HTTP 请求，且测试不应依赖外部 LLM | 否 |
| SSE 解析通过手动拆分 `\n\n` 验证 | inject() 返回完整 payload，需手动解析 SSE 格式 | 否 |
| E2E 测试放在同一 spec 文件 | b-05 只有一个端点，拆分为两个文件增加维护成本 | 是 |
| 客户端断开用 `reply.raw.destroy()` 模拟 | inject() 环境下无法真正触发 'close' 事件 | 是 |
