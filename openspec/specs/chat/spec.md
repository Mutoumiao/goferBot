# Chat - 知识问答与 SSE

## Purpose（目的）

定义 GoferBot **Chat 知识问答**的系统级规范：会话管理、强制多知识库绑定、Nest 编排与 SSE 出口、消息落库状态机与引用元数据。

> **生成与检索权威路径**：Python Knowledge AI Service（[knowledge-ai/spec.md](../knowledge-ai/spec.md)）。  
> Nest MUST 鉴权、校验 KB 所有权、注入 `_provider` / history / `kb_ids`、落库与透传 SSE。  
> MUST NOT 在 Nest 进程内执行 Knowledge 混合检索与知识答案主生成。  
> Companion 为独立能力，SSE 契约分离（见 [companion/spec.md](../companion/spec.md)）。

## Requirements（需求）

### Requirement: Chat Session Management

系统应支持创建、列出、更新和删除聊天会话。

#### Scenario: Create a new session

- **WHEN** 用户创建新聊天会话
- **THEN** 系统创建会话记录并返回其 ID

#### Scenario: List sessions with pagination

- **WHEN** 用户请求其会话列表
- **THEN** 系统返回按最后活动时间排序的分页结果

#### Scenario: Delete a session

- **WHEN** 用户删除一个聊天会话
- **THEN** 系统删除该会话及其所有关联消息

---

### Requirement: Chat 强制知识库绑定

Chat 知识问答路径 MUST 要求请求携带至少一个合法知识库 ID（`knowledge_base_ids`）。系统 MUST 在转发 Knowledge AI 前校验用户对每一个知识库的所有权。无 KB 的「纯闲聊」MUST NOT 作为 Chat 目标能力被验收通过。

#### Scenario: 无 KB 拒绝

- **WHEN** 用户发送 Chat 消息且未提供任何 kb id
- **THEN** 系统 MUST 拒绝该请求（4xx）且 MUST NOT 调用 Knowledge AI 生成

#### Scenario: 多 KB 所有权

- **WHEN** 用户提供多个 kb id 且全部属于该用户
- **THEN** 系统 MUST 允许请求并在检索范围内使用全部 kb id

#### Scenario: 含无权 KB

- **WHEN** kb id 列表中存在不属于该用户的知识库
- **THEN** 系统 MUST 拒绝请求（404 语义，避免泄露资源存在性）

---

### Requirement: 知识问答生成权归 Knowledge AI

带知识库的 Chat 答案 MUST 由 Python Knowledge AI Service 生成（`/stream` 或 `/query`）。NestJS MUST 负责鉴权、组装 `_provider`/`_prompts`/`trace_id`/`history`/`kb_ids`、消息落库与 SSE 对外出口。

#### Scenario: 转发 stream

- **WHEN** 用户在已选 KB 的会话中发送消息
- **THEN** Nest MUST 调用 Knowledge AI `/stream` 并将 SSE 透传至客户端（不整包缓冲 RAG 结果）

#### Scenario: Embedding 与索引一致

- **WHEN** Nest 组装 `_provider` 用于问答
- **THEN** embedding（及可选 rerank）配置 MUST 与文档索引路径使用同一解析策略（`rag.embeddingProvider` / 可用 embedding 池 / `rag.rerankerProvider`），MUST NOT 仅取 Chat LLM 提供商下的 embedding 而与索引向量空间不一致

---

### Requirement: 多轮每轮重检索

系统 SHALL 支持同一会话多轮对话。每一轮用户消息 MUST 重新执行 Knowledge 检索管线；Nest MUST 向 Knowledge AI 注入近期 history（默认约 10 条消息）。本轮 sources MUST 仅绑定本轮检索结果。

#### Scenario: 第二轮仍检索

- **WHEN** 用户在已有历史的会话中发送新问题
- **THEN** 系统 MUST 再次调用检索/stream，MUST NOT 仅依赖首轮检索结果回答新问题

---

### Requirement: 消息落库状态机与 sources 元数据

Nest MUST 在校验通过后先持久化用户消息；助手消息 MUST 支持状态 `streaming`（可选占位）、`completed`、`cancelled`、`failed`。成功完成时 MUST 将本轮 `sources` 写入助手消息 metadata，以便刷新后仍可展示引用。每条 source MUST 至少保留 `kb_id` 与 `document_id`。strict 空检索成功时 MUST 将 `retrieval_empty: true` 写入 metadata，且 status MUST 为 `completed`（非 `failed`）。

#### Scenario: 成功落库含 sources

- **WHEN** 流式问答正常结束且有召回
- **THEN** 助手消息 status MUST 为 completed，且 metadata 中 MUST 可读取 sources；每条 source MUST 含 `kb_id` 与 `document_id`

#### Scenario: 空检索业务成功落库

- **WHEN** Knowledge AI 以 strict 空检索业务成功结束（无合格召回）
- **THEN** 助手消息 status MUST 为 completed，sources MUST 为空列表，metadata MUST 含 `retrieval_empty: true`，MUST NOT 标记为 failed

#### Scenario: 客户端中断

- **WHEN** 客户端 abort 或连接断开
- **THEN** 系统 MUST 尝试取消上游 Knowledge AI 调用，助手消息 MUST 标记为 cancelled，并可保留已生成部分内容

#### Scenario: 上游失败

- **WHEN** Knowledge AI 超时或返回不可恢复错误
- **THEN** 助手消息 MUST 标记为 failed，用户消息 MUST 保留，客户端 MUST 可收到 error 语义（无内部栈）

---

### Requirement: Nest 调用 Knowledge AI 的分层超时与取消

Nest Knowledge AI HTTP Client MUST 支持分层超时（连接/首字节超时与整段生成超时，可配置）以及客户端 disconnect 时的取消传播。超时 MUST 映射为助手 `failed` 与可感知 `error`，MUST NOT 与 strict 空检索业务成功混淆。空服务令牌 MUST 失败关闭。

#### Scenario: 生成超时

- **WHEN** 整段生成超过配置的生成超时
- **THEN** Nest MUST 中止上游消费，助手消息 MUST 为 failed，客户端 MUST 收到错误语义

#### Scenario: 取消传播

- **WHEN** 浏览器 abort SSE
- **THEN** Nest MUST 停止消费 Python 流并尽量取消上游请求

---

### Requirement: Chat SSE 目标契约含 sources

Chat 流式响应 MUST 支持事件语义：`sources` → `message`（增量）→ `message_end`，以及 `error`。共享 Zod 契约（`packages/data` `chatMessagesChunkSchema`）MUST 容纳 `sources` 事件（含 `kb_id`/`document_id`）。`conversation_id` 与 `message_id` MUST 由 Nest 生成并在帧中携带。

#### Scenario: 前端可展示引用

- **WHEN** 流式响应包含非空 sources
- **THEN** Web Chat MUST 能展示引用信息（可区分 kb）且正文按 message 增量累积

#### Scenario: 与 Companion SSE 分离

- **WHEN** 用户使用 Companion 对话
- **THEN** 系统 MUST 继续使用 Companion 独立 SSE 契约，MUST NOT 强制与 Chat Knowledge SSE 合并为同一事件枚举语义

#### Scenario: SSE 消息格式契约

- **WHEN** 后端通过 SSE 发送 Chat 知识问答流式消息
- **THEN** 消息 MUST 遵循更新后的共享 schema：支持 `sources` / `message` / `message_end` / `error` 语义
- **AND** 前端 MUST 增量累积正文并处理 sources
- **AND** JSON 解析失败时 SHOULD 忽略坏帧并保留已累积内容

---

### Requirement: SSE Streaming Chat

系统应支持 Server-Sent Events (SSE) 流式聊天响应。对知识库问答路径，流式内容 MUST 来自 Knowledge AI 透传。

#### Scenario: Normal streaming response

- **WHEN** 用户在绑定知识库的聊天会话中发送消息
- **THEN** 系统通过 SSE 按 `sources` → `message`* → `message_end` 交付，并在完成时结束流

#### Scenario: Stream interruption

- **WHEN** 客户端断开 SSE 流连接
- **THEN** 系统应中止上游 Knowledge AI 生成并释放资源，助手消息按 cancelled 处理

#### Scenario: Error during streaming

- **WHEN** 流式传输过程中发生错误（例如上游超时）
- **THEN** 系统发送带有用户友好消息的 `error` 语义，助手消息按 failed 处理

#### Scenario: Stream 结束后处理

- **WHEN** SSE 流正常结束
- **THEN** 系统 MUST 确保助手消息已按 completed 定稿（含 sources metadata）；会话标题生成 MAY 异步执行，失败 MUST NOT 回滚已成功的消息定稿

---

### Requirement: ChatFinalize 后处理

系统 SHALL 在 Chat 知识问答流结束后处理非阻塞收尾任务。助手消息正文与 sources 的**权威定稿** MUST 在 Nest Chat 流式生命周期中完成（completed/cancelled/failed）；ChatFinalize MUST NOT 作为唯一落库助手消息的路径。标题生成 MAY 仍由异步任务执行。

#### Scenario: 标题生成非关键

- **WHEN** 助手消息已 completed 定稿后触发标题生成
- **THEN** 标题失败仅记录日志，MUST NOT 将消息改为 failed

---

## 已废止

| 废止项 | 迁移 |
|--------|------|
| Nest 内 RAG Retrieval Pipeline 权威路径 | [knowledge-ai](../knowledge-ai/spec.md) |
| ES 层 ACL 预过滤权威模型 | Nest KB 所有权 + 服务令牌 + kb_ids |
| 旧 SSE 仅 `message`/`message_end`/`error` 且无 sources | 新契约含 `sources` |
