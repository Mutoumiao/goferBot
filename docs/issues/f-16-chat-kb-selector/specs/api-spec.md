# API 规格：聊天知识库选择器

## 端点

### GET /api/knowledge-bases

获取当前用户可见的知识库列表，用于填充选择器下拉选项。

#### 认证
Bearer Token（`JwtAuthGuard`）

#### 请求
无请求体。无查询参数。

#### 响应 200
```json
[
  {
    "id": "uuid",
    "name": "string (1-100 chars)",
    "description": "string | null",
    "icon": "string | null",
    "isPinned": "boolean",
    "sortOrder": "number",
    "createdAt": "ISO-8601 string",
    "updatedAt": "ISO-8601 string"
  }
]
```

**排序规则**：后端按 `isPinned DESC, sortOrder ASC, createdAt DESC` 返回，前端直接使用该顺序渲染。

#### 错误码
| 码 | 场景 | 响应体 |
|----|------|--------|
| 401 | accessToken 缺失或过期 | `{ "statusCode": 401, "message": "Unauthorized" }` |
| 500 | 数据库查询异常 | `{ "statusCode": 500, "message": "Internal server error" }` |

---

### POST /api/chat

发送聊天消息，可选携带 `knowledgeBaseIds` 以启用 RAG 检索。

#### 认证
Bearer Token（`JwtAuthGuard`）

#### 请求
```json
{
  "message": "string (1-4000 chars)",
  "sessionId": "uuid",
  "knowledgeBaseIds": ["uuid", "uuid"],
  "config": {
    "provider": "string (min 1)",
    "model": "string (min 1)",
    "baseUrl": "valid URL in allowlist",
    "apiKey": "string (min 1)"
  }
}
```

**字段约束**：
- `knowledgeBaseIds`：可选。若提供，必须为 UUID 数组，每个元素符合 `z.string().uuid()`。数组为空时，前端应省略该字段，避免后端执行无意义的空数组检索。
- `message`：必填，1-4000 字符。
- `sessionId`：必填，UUID 格式。

#### 响应 200
SSE（`text/event-stream`），事件流格式不变：

```
data: {"chunk":"...","done":false}\n\n
data: {"chunk":"","done":true}\n\n
```

**RAG 集成影响**：
- 当 `knowledgeBaseIds` 存在且非空时，`ChatService.streamChat()` 调用 `HybridRetriever.retrieve()` + `DefaultRetrievalPostprocessor.process()`，将检索到的 chunks 拼接为 system context 注入 LLM 消息列表。
- 当 `knowledgeBaseIds` 缺失或为空时，`ChatService` 不执行检索，直接调用 LLM，行为与现有完全一致。

#### 错误码
| 码 | 场景 | 响应体（SSE 内） |
|----|------|------------------|
| 400 | `message` 为空 / 超长；`sessionId` 非 UUID；`knowledgeBaseIds` 包含非 UUID | `data: {"error":"...","done":true}\n\n` |
| 403 | `sessionId` 不属于当前用户 | `data: {"error":"无权访问该会话","done":true}\n\n` |
| 404 | `sessionId` 不存在 | `data: {"error":"会话不存在","done":true}\n\n` |
| 503 | LLM 请求失败 / 超时 | `data: {"error":"LLM 请求超时（5 分钟）","done":true}\n\n` |

#### 异步行为
- 无客户端轮询。SSE 流式返回，异常通过 SSE `error` 事件或最后一条带 `done: true` 的数据帧传递。

---

## 前后端契约

### 数据流

```
前端 ChatInput.vue
  ├─ selectedKbs: KnowledgeBase[]
  ├─ 发送时: selectedKbs.map(k => k.id) → string[]
  └─ 若空数组: 不发送 knowledgeBaseIds 字段

后端 ChatDto (Zod Schema)
  ├─ knowledgeBaseIds?: z.array(z.string().uuid())
  └─ 缺失时: undefined → ChatService 跳过检索

后端 ChatService.streamChat()
  ├─ dto.knowledgeBaseIds?.length > 0
  │   → HybridRetriever.retrieve(query, topK)
  │   → DefaultRetrievalPostprocessor.process(candidates, query)
  │   → 拼接 chunks 为 systemContext
  │   → 注入 llmMessages
  └─ 否则: 直接调用 LLM
```

### 版本兼容性

- **旧前端 + 新后端**：旧前端不发送 `knowledgeBaseIds`，后端 `.optional()` 兼容，行为无变化。
- **新前端 + 旧后端**：若后端未部署 `b-09`（Zod schema 无 `knowledgeBaseIds`），ZodValidationPipe 会拒绝未知字段，导致 400。因此前端在发送前检查 schema 版本或依赖 issue 依赖关系确保 `b-09` 先完成。

---

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| 正常请求（带 kbIds） | `tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts` | `AC-01: injects retrieval context when knowledgeBaseIds provided` |
| 正常请求（不带 kbIds） | `tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts` | `AC-02: skips retrieval when knowledgeBaseIds omitted` |
| 参数错误（非 UUID kbId） | `tests/issues/b-09-chat-rag-retrieval/chat-rag.spec.ts` | `AC-03: returns 400 for invalid knowledgeBaseIds` |
| 知识库列表获取 | `tests/issues/b-02-knowledge-base-crud-api/knowledgeBaseCrud.spec.ts` | `AC-01: lists knowledge bases for authenticated user` |
| 空列表 | `tests/issues/b-02-knowledge-base-crud-api/knowledgeBaseCrud.spec.ts` | `AC-04: returns empty array when no knowledge bases` |
| 未认证 | `tests/issues/b-02-knowledge-base-crud-api/knowledgeBaseCrud.spec.ts` | `AC-05: returns 401 without token` |
