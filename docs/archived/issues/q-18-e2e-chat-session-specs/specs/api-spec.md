# q-18 API 规格

## 聊天涉及的 API

### SSE 流式聊天
- `POST /api/chat` — SSE 流式响应
  - Request: `{ message: string, sessionId: string, config: LLMConfig, knowledgeBaseIds?: string[] }`
  - Response: `text/event-stream`

### 会话管理
- `GET /api/sessions` — 列表
- `POST /api/sessions` — 创建
- `GET /api/sessions/:id` — 详情（含消息历史）
- `POST /api/sessions/:id/rename` — 重命名
- `DELETE /api/sessions/:id` — 删除

## 前端路由

- `/app/chat` — 聊天页面
- `/app/history` — 历史记录页面

## 关键 data-testid

- `[data-testid="chat-input"]` — 聊天输入框
- `[data-testid="chat-send-btn"]` — 发送按钮
- `[data-testid="chat-message-list"]` — 消息列表
- `[data-testid="chat-message"]` — 单条消息
- `[data-testid="kb-mention-dropdown"]` — 知识库选择器
- `[data-testid="kb-mention-pill"]` — 已选知识库标签
- `[data-testid="tab-bar"]` — 标签栏
- `[data-testid="new-chat-btn"]` — 新建聊天按钮
- `[data-testid="session-list"]` — 会话列表
- `[data-testid="session-item"]` — 单条会话
