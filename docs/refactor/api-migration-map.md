# API 变更对照表

> 来源：`T-01` 前端调用点梳理  
> 范围：chat / knowledge-base / session 模块  
> 生成日期：2026-06-15

---

## Chat 模块

| 旧路径 | 旧方法 | 新路径 | 新方法 | 前端影响文件 |
|--------|--------|--------|--------|--------------|
| `/chat/message` | POST | `/chat-messages` | POST | `packages/web/src/api/chat.ts`（`sendMessage`） |
| `/chat/init` | GET | 删除 | - | `packages/web/src/api/chat.ts`（`getChatInit` 删除） |
| `/chat/providers` | GET | `/chat-messages/providers` | GET | `packages/web/src/api/chat.ts`（`getChatProviders`） |
| `/chat/knowledge-bases` | GET | 删除 | - | `packages/web/src/features/chat/services.ts`（不再通过 chat 初始化获取 KB） |
| `/messages` | GET | `/chat-messages` | GET | `packages/web/src/api/chat.ts`（`getMessages`） |
| `/sessions/:id/rename` | POST | `/sessions/:id` | PATCH | `packages/web/src/api/chat.ts`（`renameSession`） |

### 字段变更

| Schema | 旧字段 | 变更 | 说明 |
|--------|--------|------|------|
| `ChatMessagesRequest` | `knowledge_base_ids` | 删除后重新加回（可选） | 作为 RAG 检索端口预留字段，后续 KB/RAG 模块可注入 `ChatContextRetriever` 实现检索 |
| `ChatMessagesRequest` | `response_mode` | 新增 | `'streaming' \| 'blocking'`，当前仅实现 `streaming` |
| SSE 事件 | `message` | 保留 | 每段流式内容 |
| SSE 事件 | - | 新增 `message_end` | 流式结束标记 |
| SSE 事件 | - | 新增 `error` | 异常通过 SSE error 事件发送 |

### 前端必须修改点

1. **`packages/web/src/api/chat.ts`**
   - `sendMessage` 路径改为 `/chat-messages`。
   - `getChatInit` 删除。
   - `getChatProviders` 路径改为 `/chat-messages/providers`。
   - `getMessages` 路径改为 `/chat-messages`。
   - `renameSession` 方法改为 `PATCH /sessions/${sessionId}`。

2. **`packages/web/src/api/x-chat.ts`**
   - `xChatRequest` 目标 URL 保持 `/chat-messages`，但需确认 SSE 事件字段调整。

3. **`packages/web/src/features/chat/services.ts`**
   - `fetchProviders` 中 `getChatProviders` 路径变更。
   - `loadChatHistory` 中 `getMessages` 路径变更。
   - `submitTempChat` 接收可选 `knowledgeBaseIds`，pending message 以 JSON 存储 `{ content, knowledgeBaseIds }`，跨导航保留 KB 选择。

4. **`packages/web/src/features/chat/components/ChatTempHome.tsx` / `components/ChatPage.tsx` / `providers/GoferChatProvider.ts`**
   - `ChatTempHome` 保留 `KnowledgeBaseSelector`，将 `selectedKbIds` 传入 `submitTempChat`。
   - `ChatPage` 读取 pending JSON 中的 `knowledgeBaseIds`，并在首次 `onRequest` 中拼入 `knowledge_base_ids`。
   - `GoferChatProvider.transformParams` 透传 `knowledge_base_ids`。

---

## Knowledge-base 模块

| 旧路径 | 旧响应 | 新路径 | 新响应 | 前端影响文件 |
|--------|--------|--------|--------|--------------|
| `GET /knowledge-bases` | `{ entries, total }` | 同 | `{ items, pagination }` | `packages/web/src/features/KnowledgeBase/services.ts`（`fetchKbList`） |
| `GET /knowledge-bases/:id/documents` | 数组 | 同 | `{ items, pagination }` | `packages/web/src/api/file.ts`（`getDocuments`） |
| - | - | `GET /knowledge-bases/:id/documents/:docId/status` | `{ status, indexedAt, error? }` | 新增调用点 |

### 字段变更

| Schema | 旧字段 | 变更 | 说明 |
|--------|--------|------|------|
| `Document` | - | 新增 `status` | `uploaded` / `queued` / `processing` / `indexed` / `failed` |
| `Document` | - | 新增 `indexedAt` | 索引完成时间 |
| `Document` | `size`（BigInt） | 统一为 `number` | 前端无需处理 BigInt |

### 前端必须修改点

1. **`packages/web/src/features/KnowledgeBase/services.ts`**
   - `fetchKbList` 从 `res.entries` 改为 `res.items`。
   - `loadKbItems` 中 `getDocuments` 返回结构改为分页。

2. **`packages/web/src/api/file.ts`**
   - `getDocuments` 返回类型改为分页响应。

3. **`packages/web/src/features/KnowledgeBase/types.ts`**
   - `DocumentItem` 增加 `status`、`indexedAt` 字段。

4. **`packages/web/src/features/KnowledgeBase/components/*`**
   - UI 展示文档索引状态。

---

## Session 模块

| 旧路径 | 旧方法 | 新路径 | 新方法 | 前端影响文件 |
|--------|--------|--------|--------|--------------|
| `/sessions/:id/rename` | POST | `/sessions/:id` | PATCH | `packages/web/src/api/chat.ts`（`renameSession`） |
| `GET /sessions/:id/messages` | 自定义 | 同 | 标准分页 `{ items, pagination }` | `packages/web/src/api/chat.ts`（`getMessages`） |

---

## 变更风险

1. `POST /chat-messages` 同时承担 SSE 流式与旧 `/chat/message` 非流式职责，前端 `sendMessage` 可能需要废弃或改为 SSE 入口。
2. `Document.size` 类型变更需要确认后端 Prisma schema 类型。
3. 删除 `/chat/init` 后，前端初始化逻辑需要拆分为多个独立请求。

---

## 下一步

- 后端完成接口改造后，使用 `/integration-check` 校验前后端一致性。
