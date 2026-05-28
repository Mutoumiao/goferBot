# API 规格：对话 RAG 检索接入

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
  "knowledgeBaseIds": ["uuid"],
  "config": {
    "provider": "string (min 1)",
    "model": "string (min 1)",
    "baseUrl": "string (合法 URL + SSRF 白名单)",
    "apiKey": "string (min 1)"
  }
}
```

**字段变更说明**：

| 字段 | 类型 | 必填 | 约束 | 说明 |
|------|------|------|------|------|
| `message` | `string` | 是 | `1-4000` 字符 | 用户输入消息 |
| `sessionId` | `string` | 是 | UUID v4 | 会话标识 |
| `knowledgeBaseIds` | `string[]` | 否 | 每项 UUID v4，数组非空时生效 | 指定检索目标知识库；不传或传空数组时不触发检索 |
| `config.provider` | `string` | 是 | 非空 | LLM 提供商标识 |
| `config.model` | `string` | 是 | 非空 | 模型名称 |
| `config.baseUrl` | `string` | 是 | 合法 URL 且在 SSRF 白名单内 | API 基础地址 |
| `config.apiKey` | `string` | 是 | 非空 | API 密钥 |

#### 响应 200

响应头：
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

SSE 流式 chunk 格式：
```
data: {"chunk":"string","done":false}\n\n
```

结束标记：
```
data: {"chunk":"","done":true}\n\n
```

#### 错误码

| 码 | 场景 | 传递方式 | 响应体 |
|----|------|----------|--------|
| 400 | `message` 为空或超过 4000 字符 | HTTP 响应（`ZodValidationPipe`） | `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }` |
| 400 | `sessionId` 不是合法 UUID | HTTP 响应（`ZodValidationPipe`） | 同上 |
| 400 | `knowledgeBaseIds` 中包含非 UUID 字符串 | HTTP 响应（`ZodValidationPipe`） | 同上 |
| 400 | `config.baseUrl` 不在白名单 | HTTP 响应（`ZodValidationPipe`） | 同上 |
| 400 | 会话不存在 | SSE 流内 error | `data: {"error":"会话不存在","done":true}\n\n` |
| 400 | 无权访问该会话 | SSE 流内 error | `data: {"error":"无权访问该会话","done":true}\n\n` |
| 401 | 未携带 Authorization | HTTP 响应 | `{ "error": { "code": "AUTH_ERROR", "message": "..." } }` |
| 503 | LLM API 请求失败 | SSE 流内 error | `data: {"error":"LLM 请求失败: ...","done":true}\n\n` |
| 503 | LLM 请求超时（默认 5 分钟） | SSE 流内 error | `data: {"error":"LLM 请求超时（5 分钟）","done":true}\n\n` |

#### 异步行为

- LLM 请求通过 `fetch()` 发起，使用 `AbortController` 控制超时
- 超时时间由环境变量 `LLM_TIMEOUT_MS` 配置（默认 `300000` ms）
- 客户端断开时 `reply.raw.on('close')` 触发 `abortController.abort()`
- 检索阶段（`HybridRetriever.retrieve` + `DefaultRetrievalPostprocessor.process`）在 LLM 请求前同步执行，不单独设置超时；若检索阶段抛出异常，捕获后降级为无 context 的 LLM 调用

---

## RAG 检索上下文注入流程

当 `dto.knowledgeBaseIds` 存在且数组长度大于 0 时，`ChatService.streamChat()` 执行以下步骤：

1. 构造 `Query` 对象：
   ```typescript
   const query: Query = {
     original: dto.message,
     kbIds: dto.knowledgeBaseIds,
   }
   ```

2. 调用 `HybridRetriever.retrieve(query, 10)` 获取候选 chunks（`topK=10`）

3. 调用 `DefaultRetrievalPostprocessor.process(candidates, query)` 过滤排序

4. 若处理后 `candidates.length > 0`，将 chunks 内容拼接为 context：
   ```typescript
   const systemContext = processed.map(c => c.chunk.content).join('\n---\n')
   ```

   > **注意**：`HybridRetriever` 返回的 `RetrievalCandidate.chunk.content` 可能为空（向量检索结果不携带 content）。`ChatService` 需在注入前通过 `chunkId` 反查 PG `chunks` 表补全 content，或依赖 `KeywordService` 返回的完整 content。实现时确保 `systemContext` 不为空字符串。

5. 在 `llmMessages` 数组头部注入 system message：
   ```typescript
   {
     role: 'system',
     content: `基于以下上下文回答问题：\n${systemContext}`
   }
   ```

6. 若 `knowledgeBaseIds` 未传、为空数组、或检索/后处理无结果，则不注入 system message，`llmMessages` 仅包含历史消息

---

## 降级行为

| 场景 | 行为 | 用户感知 |
|------|------|----------|
| `knowledgeBaseIds` 未传或为空数组 | 跳过检索，直接调用 LLM | 对话行为与现有完全一致 |
| 检索无结果（postprocessor 返回空数组） | 正常调用 LLM，不注入 system context | 回答基于模型知识 |
| `HybridRetriever.retrieve` 抛出异常（如向量库断开） | 捕获异常，降级为无 context 的 LLM 调用，记录 warn 日志 | 对话继续，回答基于模型知识 |
| `DefaultRetrievalPostprocessor.process` 抛出异常 | 捕获异常，降级为无 context 的 LLM 调用，记录 warn 日志 | 对话继续，回答基于模型知识 |
| 关键词检索失败（如 `zhparser` 未安装） | `HybridRetriever` 内部已处理：纯向量结果可用时返回向量结果，否则抛出异常后由外层捕获降级 | 对话继续，检索质量可能下降 |

---

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| DTO 校验 - `knowledgeBaseIds` 合法 UUID 数组 | `tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts` | `AC-01: accepts valid knowledgeBaseIds array` |
| DTO 校验 - `knowledgeBaseIds` 包含非法值 | `tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts` | `AC-02: returns 400 when knowledgeBaseIds contains invalid UUID` |
| 检索注入 - `knowledgeBaseIds` 存在时 system message 包含 context | `tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts` | `AC-03: injects retrieved chunks into system message` |
| 无回归 - 未传 `knowledgeBaseIds` 时不触发检索 | `tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts` | `AC-04: skips retrieval when knowledgeBaseIds is omitted` |
| 无回归 - `knowledgeBaseIds` 为空数组时不触发检索 | `tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts` | `AC-05: skips retrieval when knowledgeBaseIds is empty array` |
| 降级 - 检索无结果时正常调用 LLM | `tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts` | `AC-06: falls back to plain LLM when retrieval returns empty` |
| 降级 - 检索异常时正常调用 LLM | `tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts` | `AC-07: falls back to plain LLM when retrieval throws` |
| 降级 - 向量检索结果 content 为空时反查补全 | `tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts` | `AC-09: falls back to chunk content lookup when vector result has empty content` |
| SSE 格式 - RAG 场景下 SSE 流格式不变 | `tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts` | `AC-08: SSE stream format unchanged with RAG enabled` |
