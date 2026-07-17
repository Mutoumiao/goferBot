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

### Requirement: Web Chat 桌面工作台会话交互

Web `/chats` 工作台 MUST 采用「左会话列表 + 右工作区」本地选中态模型：当前会话 id 存于客户端状态（`selectedSessionId`），MUST NOT 依赖 URL search 切换会话。新建会话的权威路径 MUST 为：用户在「智能对话」空态完成首条有效发送后创建 Session，再进入该会话；MUST NOT 依赖独立的「+ 新会话」按钮作为主流程。

#### Scenario: 智能对话空态

- **WHEN** 用户点击会话列表「智能对话」入口（或当前无选中会话）
- **THEN** 客户端 MUST 清空 `selectedSessionId` 并展示空态输入区（问候 + 统一输入组件）
- **AND** MUST NOT 要求单独的「新会话」按钮才能进入空态

#### Scenario: 空态首条发送创建会话

- **WHEN** 用户在空态已选至少一个知识库并成功提交首条问题
- **THEN** 客户端 MUST 创建 Session，将 `selectedSessionId` 指向新 Session
- **AND** 会话列表 MUST 出现该会话（或通过刷新列表后出现）且选中态指向该会话

#### Scenario: 统一输入组件

- **WHEN** 用户处于空态或已打开会话
- **THEN** 输入区 MUST 共用同一组件能力：知识库多选（至少一个）、模型选择、文本输入与发送/中止
- **AND** MUST NOT 展示未实现能力的主路径入口（如附件上传、语音、场景营销卡、Copilot/工作流占位）

#### Scenario: 无独立历史页与 Tab 工作区

- **WHEN** 用户在 Web 使用 Chat
- **THEN** 会话列表 MUST 仅存在于 `/chats` 左栏（`SessionListPanel`）
- **AND** MUST NOT 再提供独立「会话历史」页面作为主路径
- **AND** MUST NOT 依赖顶部 TabBar / tabManager / workspace tabs 管理会话选中

---

### Requirement: Web Chat 引用来源展示

当助手消息含 sources 时，Web Chat MUST 默认以紧凑摘要展示（如「引用 N 篇资料作为参考」），MUST NOT 默认展开段落正文。用户点击摘要后 MUST 可查看按 `document_id` 去重的文档级列表；列表 MUST 以文档标识/名称为主，MUST NOT 默认展示 chunk 正文。

#### Scenario: 紧凑引用摘要

- **WHEN** 流式或历史消息含非空 sources
- **THEN** UI MUST 展示文档篇数摘要，且默认视图 MUST NOT 渲染各 source 的 content 段落

#### Scenario: 文档列表浮层

- **WHEN** 用户点击引用摘要
- **THEN** UI MUST 展示文档级列表（按 `document_id` 去重），条目含可识别的文档标签
- **AND** 列表 MUST NOT 默认展开 chunk content

#### Scenario: 空检索提示

- **WHEN** 消息 metadata 含 `retrieval_empty: true` 或等价语义
- **THEN** UI MUST 给出未检索到相关资料的轻量提示，MUST NOT 展示假造 sources

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

Nest MUST 在校验通过后先持久化用户消息；助手消息 MUST 支持状态 `streaming`（可选占位）、`completed`、`cancelled`、`failed`。成功完成时 MUST 将本轮 `sources` 写入助手消息 metadata，以便刷新后仍可展示引用。每条 source MUST 至少保留 `kb_id` 与 `document_id`。strict 空检索成功时 MUST 将 `retrieval_empty: true` 写入 metadata，且 status MUST 为 `completed`（非 `failed`）。当本轮发生 RAG/Knowledge AI 已定义的管线降级且仍完成业务响应时，metadata MUST 包含 `degraded: true`。

证据来源（观测相关）：
- `packages/server/src/modules/chat/chat.service.ts`（`buildChatMetadata`）
- `packages/data/src/schemas/chat.schema.ts`（`messageMetadataSchema`）

#### Scenario: 成功落库含 sources

- **WHEN** 流式问答正常结束且有召回
- **THEN** 助手消息 status MUST 为 completed，且 metadata 中 MUST 可读取 sources；每条 source MUST 含 `kb_id` 与 `document_id`

#### Scenario: 空检索业务成功落库

- **WHEN** Knowledge AI 以 strict 空检索业务成功结束（无合格召回）
- **THEN** 助手消息 status MUST 为 completed，sources MUST 为空列表，metadata MUST 含 `retrieval_empty: true`，MUST NOT 标记为 failed

#### Scenario: 降级成功响应可聚合

- **WHEN** Knowledge AI / RAG 管线标记 degraded 且助手消息以 completed 定稿
- **THEN** metadata MUST 含 `degraded: true`
- **AND** Admin 聚合可将该消息计入降级样本

#### Scenario: 未降级

- **WHEN** 本轮未发生 degraded
- **THEN** metadata MUST NOT 错误标记 `degraded: true`
- **AND** MUST 省略 `degraded` 字段（推荐风格；不得写 `false` 冒充「已降级样本」之外的语义混淆）

#### Scenario: 埋点上线后 Admin 行为

- **WHEN** Chat 定稿路径已支持 `degraded` 写入
- **THEN** Admin 降级率 KPI MUST 按时间窗内 completed 助手消息样本计算
- **AND** 窗内样本数为 0 时 KPI status MUST 为 `insufficient_samples`
- **AND** MUST NOT 用虚构降级率填充

#### Scenario: 客户端中断

- **WHEN** 客户端 abort 或连接断开
- **THEN** 系统 MUST 尝试取消上游 Knowledge AI 调用，助手消息 MUST 标记为 cancelled，并可保留已生成部分内容

#### Scenario: 上游失败

- **WHEN** Knowledge AI 超时或返回不可恢复错误
- **THEN** 助手消息 MUST 标记为 failed，用户消息 MUST 保留，客户端 MUST 可收到 error 语义（无内部栈）

### Requirement: 可选端到端延迟（非一期 SHALL）

Chat 助手 metadata MAY 写入 `latencyMs` 供未来观测；一期 Admin Hub MUST NOT 将 Chat P95 作为必选黄金 KPI。若未写入，Admin MUST NOT 伪造 Chat 延迟曲线。

#### Scenario: 未写 latency

- **WHEN** 助手消息未包含 `latencyMs`
- **THEN** 现有 RAG 空结果/降级/索引失败聚合 MUST 仍可独立工作

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
- **THEN** Web Chat MUST 能展示引用信息（文档级、可区分 kb）且正文按 message 增量累积
- **AND** 默认展示 MUST 符合「紧凑摘要 + 按需文档列表」要求（见「Web Chat 引用来源展示」）

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
