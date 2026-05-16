状态: needs-triage
分类: enhancement

## 要构建的内容

实现 LLM 问答 SSE 流式 API，支持多知识库 RAG 检索（预留）。

## 规格引用

- 功能规格: docs/03-specs/features/chat-sse/feature-spec.md
- 行为规格: docs/03-specs/features/chat-sse/behavior-spec.md
- API 规格: docs/03-specs/features/chat-sse/api-spec.md

## 验收标准

- [ ] `POST /api/chat` 接收消息并返回 SSE 流
- [ ] 请求体：`{ message, sessionId, knowledgeBaseIds?, config }`
- [ ] SSE 流格式：`data: { chunk: string, done: boolean }`
- [ ] 流结束时发送 `data: { done: true }`
- [ ] 消息保存到数据库（用户消息 + AI 消息）
- [ ] 支持多知识库选择（knowledgeBaseIds 数组）
- [ ] 知识库选择时预留 RAG 接口（当前先返回空结果，不阻塞对话）
- [ ] 支持切换 LLM 提供商（从 config 读取 provider、model）
- [ ] 错误处理：LLM 调用失败时返回错误事件流
- [ ] 超时处理：LLM 响应超时时返回超时错误
- [ ] 所有接口需要认证

## 阻塞于

- b-03-session-api（需要会话管理）
- i-05-redis-bullmq-setup（需要异步任务框架，预留 RAG）

## 范围外

- 完整的 RAG 检索实现（Phase 5）
- 多轮对话上下文压缩
- 对话分支/分叉

## Agent 简报

**分类：** enhancement
**摘要：** LLM 问答 SSE 流式 API，支持多知识库选择（RAG 预留）

**当前行为：**
后端无对话 API。

**期望行为：**
前端可通过 SSE 流实时接收 AI 回复，支持多知识库选择和不同 LLM 提供商。

**关键接口：**
- `POST /api/chat` — SSE 流式对话
- SSE 格式：`data: { chunk, done }`
- 预留 RAG 接口调用

**验收标准：**
- [ ] SSE 流式响应
- [ ] 正确的请求体格式
- [ ] 流结束标记
- [ ] 消息保存到数据库
- [ ] 支持多知识库选择
- [ ] RAG 预留接口（返回空）
- [ ] 支持切换 LLM 提供商
- [ ] LLM 错误处理
- [ ] 超时处理
- [ ] 接口需要认证

**范围外：**
- 完整 RAG 实现
- 上下文压缩
- 对话分支
