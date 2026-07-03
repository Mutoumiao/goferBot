# Chat - 聊天与 RAG 检索增强

## Purpose（目的）

定义 GoferBot 聊天会话管理、SSE 流式对话、RAG 检索增强生成管线的系统级规范。覆盖会话 CRUD、消息流式传输、混合检索、重排序、输出安全与事实校验能力。

## Requirements（需求）

### Requirement: Chat Session Management
系统应支持创建、列出、更新和删除聊天会话，每个会话关联一个知识库。

证据来源：
- `packages/server/src/modules/chat/chat.controller.ts`
- `packages/server/src/modules/chat/chat.service.ts`
- `packages/web/src/stores/chat.ts`

#### Scenario: Create a new session
- **WHEN** 用户创建一个关联选定知识库的新聊天会话
- **THEN** 系统创建会话记录并返回其 ID

#### Scenario: List sessions with pagination
- **WHEN** 用户请求其会话列表
- **THEN** 系统返回按最后活动时间排序的分页结果，默认每页最多 50 条

#### Scenario: Delete a session
- **WHEN** 用户删除一个聊天会话
- **THEN** 系统删除该会话及其所有关联消息

### Requirement: SSE Streaming Chat
系统应支持 Server-Sent Events (SSE) 流式聊天响应，增量式交付 tokens。

证据来源：
- `packages/server/src/modules/chat/chat.controller.ts` (SSE endpoint)
- `packages/server/src/modules/chat/chat.service.ts` (streaming logic)
- `packages/web/src/api/x-chat.ts` (SSE client)

#### Scenario: Normal streaming response
- **WHEN** 用户在聊天会话中发送消息
- **THEN** 系统通过 SSE 以 `text` 事件流式传输 tokens，并在完成时发送 `done` 事件

#### Scenario: Stream interruption
- **WHEN** 客户端断开 SSE 流连接
- **THEN** 系统应中止 LLM 生成并释放资源

#### Scenario: Error during streaming
- **WHEN** 流式传输过程中发生错误（例如 LLM 超时）
- **THEN** 系统发送带有用户友好消息的 `error` 事件

#### Scenario: Stream 结束后处理
- **WHEN** SSE 流正常结束
- **THEN** 系统 SHALL 通过 StreamFinalizeService 调度后处理任务（异步持久化助手消息 + 自动生成会话标题）到 `chat-finalize` 队列或 queueMicrotask 降级模式

#### Scenario: SSE 消息格式契约
- **WHEN** 后端通过 SSE 发送 Chat 流式消息时
- **THEN** 消息 SHALL 遵循 `chatMessagesChunkSchema` Zod schema 契约：`{event: 'message'|'message_end'|'error', conversation_id, message_id, answer, done?, error?}`
- **AND** 前端 `GoferChatProvider.transformMessage` 通过 `originMessage.content + chunk.answer` 增量累积内容
- **AND** JSON 解析失败时 SHALL 静默忽略，保留当前已累积内容

### Requirement: RAG Retrieval Pipeline
系统应支持完整的 RAG 管线：Query Understanding → Hybrid Retrieval (BM25 + Vector) → RRF Fusion → Reranker → Parent Resolution → LLM Generation，带有 Redis 缓存。

证据来源：
- `packages/server/src/processors/rag/rag-retrieval.service.ts`
- `packages/server/src/processors/rag/rag.module.ts`
- `packages/server/src/processors/rag/rag-types.ts`

#### Scenario: Complete pipeline execution
- **WHEN** 聊天消息触发 RAG 检索
- **THEN** 系统应执行：QueryUnderstanding → Router.decide（确定 mode/topK/candidateK/needRerank）→ retrieval（vector/bm25/hybrid）→ RRF fusion → BGE Rerank（条件性）→ Parent Resolution → Redis Cache

#### Scenario: Hybrid retrieval with RRF fusion
- **WHEN** 选择混合模式
- **THEN** 系统并行执行 BM25（关键词）和 dense vector（语义）搜索，通过应用层加权 RRF 融合结果：`vectorWeight/(rrfK+rank+1) + bm25Weight/(rrfK+rank+1)`，默认值 vector=0.7, bm25=0.3, rrfK=60。如果一个 chunk 出现在两个渠道中，两个分数会累加。

#### Scenario: BGE Reranker re-ranking
- **WHEN** RRF fusion 产生候选结果且 Router 确定需要重排序
- **THEN** 系统应用 BGE-Reranker Cross-Encoder（可通过管理面板 `rag.rerankerProvider` 配置模型，白名单前缀：BAAI/Xorbits/sentence-transformers）进行第二阶段重排序，当重排序模型不可用时回退到词汇匹配（50%）+ 原始分数（50%）

#### Scenario: Parent-Child chunk resolution
- **WHEN** 检索到的 chunks 是子 chunks（child=150 字符，parent=800 字符）
- **THEN** 系统应通过 parent_id 将它们解析为其父 chunks，按 parent_id 去重，确保每个父 chunk 只出现一次

#### Scenario: Redis result caching
- **WHEN** 检索成功完成
- **THEN** 系统应将结果缓存到 Redis，键为 `rag:retrieval:{query}|{kbIds}|{mode}|{topK}|...|{userId}`，TTL 为 60 秒，后续相同查询返回缓存结果

### Requirement: ACL-Prefiltered Retrieval
系统应在检索层面强制执行访问控制，在向量搜索的 ANN 遍历之前以及 LLM 上下文组装之前，基于用户权限过滤搜索结果。

证据来源：
- `packages/server/src/processors/rag/es-vector.service.ts#L42-L64`
- `packages/server/src/processors/rag/es-filter.builder.ts#L22-L98`
- `packages/server/src/processors/rag/rag-retrieval.service.ts#L49-L66`

#### Scenario: Vector search pre-filter
- **WHEN** 执行 ES knn 向量搜索
- **THEN** 系统应通过 `knn.filter` 在 ANN 遍历之前应用 ACL 过滤器，确保未授权文档永远不会进入候选集 —— 比检索后过滤更安全

#### Scenario: Knowledge base ownership verification
- **WHEN** 聊天会话触发 RAG 检索
- **THEN** 系统应（1）如果未明确提供 kbIds 则拒绝请求，（2）通过 Prisma 验证用户拥有所有指定的知识库

#### Scenario: User and team ACL logic
- **WHEN** 文档 chunks 包含 `allowed_user_ids` / `allowed_team_ids` 字段
- **THEN** 系统应使用 ES `should` 子句：如果用户在允许列表中 OR ACL 字段不存在（公共文档），则该 chunk 可见，确保与非 ACL 文档的向后兼容性

### Requirement: Output Guardrails
系统应在 LLM 生成后应用输出安全过滤器：PII 脱敏、敏感关键词检测和领域免责声明注入。

证据来源：
- `.trae/specs/enterprise-rag/spec.md` (GuardrailService)

#### Scenario: PII redaction
- **WHEN** LLM 输出包含邮箱、电话号码、身份证号码或银行卡号
- **THEN** 系统将其脱敏为 `[EMAIL REDACTED]`、`[PHONE REDACTED]`、`[ID_CARD REDACTED]`、`[BANK_CARD REDACTED]`

#### Scenario: Sensitive keyword warning
- **WHEN** LLM 输出包含敏感关键词（政治、成人、暴力内容）
- **THEN** 系统应在响应元数据中附加警告信息

### Requirement: Output Grounding
系统应评估 LLM 生成的答案相对于检索到的源文档的事实准确性。

证据来源：
- `.trae/specs/enterprise-rag/spec.md` (GroundingService)

#### Scenario: Grounding score calculation
- **WHEN** LLM 使用 RAG 上下文生成响应
- **THEN** 系统使用混合 Token Overlap（40%）+ Bigram Match（60%）计算准确性分数

#### Scenario: Ungrounded sentence flagging
- **WHEN** LLM 输出中的某个句子与任何源文档都没有 token 重叠
- **THEN** 系统在响应元数据中将其标记为"潜在生成内容"

### Requirement: ChatFinalize 后处理
系统 SHALL 在 SSE 流结束后通过 ChatFinalizeProcessor 异步处理消息持久化和基于 LLM 的会话标题生成。

证据来源：
- `packages/server/src/processors/chat/chat-finalize.processor.ts`
- `packages/server/src/common/services/stream-finalize.service.ts`
- `packages/server/src/queue/queues.ts#L17-L25`

#### Scenario: 消息持久化（关键操作）
- **WHEN** ChatFinalizeProcessor 处理任务时
- **THEN** Step 1 执行 `saveAssistantMessage(sessionId, messageId, fullReply)` → 失败抛异常触发 BullMQ 重试（attempts=5）

#### Scenario: 标题生成（非关键操作）
- **WHEN** 消息持久化成功后
- **THEN** Step 2 使用 LLM 自动生成会话标题 → 失败仅记录日志，不触发重试

#### Scenario: 标题生成 Provider 选择
- **WHEN** 自动生成会话标题时
- **THEN** 优先使用 `config.chat.defaultProvider` → 降级使用 enabledProviders 中其他可用 LLM provider → 无可用 provider 时跳过标题生成

#### Scenario: 队列不可用降级
- **WHEN** BullMQ `chat-finalize` 队列不可用时
- **THEN** StreamFinalizeService 降级为 `queueMicrotask` 模式，在微任务中恢复 RequestContext 后同步执行后处理步骤
