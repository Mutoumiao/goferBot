# Companion - AI 伴侣对话

## Purpose（目的）

定义 GoferBot AI 伴侣（Companion）的对话管线系统级规范。覆盖 LangGraph 状态图结构、节点执行顺序、条件路由、LLM 调用约束、安全中断机制、LangChain 适配层（StructuredOutput 降级链 + LlmConfigService 热更新）。

> Companion 与 **Knowledge AI / Chat 知识库问答** 隔离：独立路由、独立 SSE 契约；MUST NOT 调用 Knowledge AI 文档索引/知识检索/知识问答作为伴侣主路径。

## Requirements（需求）

### Requirement: Companion 与 Knowledge AI 隔离

AI Companion MUST 保持为独立产品能力：独立路由、独立 API、独立生成链路。Companion MUST NOT 调用 Knowledge AI 的文档索引/知识库检索/知识问答 API 作为记忆或对话实现；Companion 记忆 MUST NOT 写入 `knowledge.chunks` 或知识库 `kb_id` 文档索引。

#### Scenario: 伴侣对话不经 Knowledge AI

- **WHEN** 用户发送 Companion 消息
- **THEN** 系统 MUST 走 Companion 既有（Nest）管线生成回复，MUST NOT 将请求转发至 Knowledge AI `/stream` 作为伴侣主路径

### Requirement: LangGraph StateGraph Execution Order

系统应按照以下固定顺序执行 Companion 对话管线，作为一个包含 11 个节点的 LangGraph StateGraph：safety → intent → emotion → relationship → route → policy → generate → quality → summary → memory_candidate → memory_extraction。

证据来源：
- `packages/server/src/modules/companion/langgraph/graph.ts#L130-L221`

#### Scenario: Complete pipeline execution

- **WHEN** 用户向 AI 伴侣发送消息
- **THEN** 系统按顺序执行所有 11 个节点，每个节点接收所有前置节点的输出作为上下文

#### Scenario: Per-node stream emission

- **WHEN** StateGraph 执行每个节点时
- **THEN** 系统通过 `streamMode: 'updates'` 产生逐节点状态补丁，允许外部消费者观察中间结果

### Requirement: Conditional Branching

系统应在 StateGraph 管线中支持条件分支；Safety 硬中断与 Memory 跳过保持；Quality 结果 MUST 采用观测型语义，不得因 quality fail 丢弃主回复或跳过 summary/memory。

证据来源：
- `packages/server/src/modules/companion/langgraph/graph.ts`
- 行为权威：ai-partner-agent inbox QualityGuard（评测后仍保存助手消息）

#### Scenario: Safety block termination

- **WHEN** safety 节点输出的 `boundaryAction` 等于 `'refuse'` 或 `'crisis_support'`
- **THEN** 图应立即终止（END），返回包含 `safetyReason` 的安全中断响应，且 MUST NOT 持久化正常情感向助手回复

#### Scenario: Quality check failure is observational

- **WHEN** quality guard 节点将回复标为 `status: 'fail'`（或等价未通过）
- **THEN** 系统 MUST 仍保留 `assistantReply` 供下发与落库
- **AND** 系统 MUST 将 quality 结果纳入消息 metadata
- **AND** 系统 MUST NOT 仅因 quality fail 而跳过 summary 与 memory_candidate/memory_extraction 路径
- **AND** safety `refuse` / `crisis_support` 仍为硬中断（与 quality 观测语义独立）

#### Scenario: Memory extraction skip

- **WHEN** memory candidate 节点判定没有有意义的记忆应被提取（`shouldExtract === false`）
- **THEN** 图应跳过 memory_extraction 节点并终止（END）

### Requirement: LLM Call Budget

系统每轮对话最多调用 7 次 LLM。Route、Policy 和 QualityGuard 节点必须作为纯规则引擎实现，零 LLM 成本。

证据来源：
- `packages/server/src/modules/companion/langgraph/nodes/route-node.ts#L192-L198`
- `packages/server/src/modules/companion/langgraph/nodes/policy-node.ts#L209-L233`
- `packages/server/src/modules/companion/langgraph/nodes/quality-guard-node.ts#L38-L62`

#### Scenario: LLM nodes

- **WHEN** 管线执行时
- **THEN** 只有 safety、intent、emotion、relationship、summary、memory_candidate 和 memory_extraction 节点应调用 LLM
- **AND** memory_extraction 是条件性的（仅在 shouldExtract 为 true 时调用）

#### Scenario: Rule engine nodes

- **WHEN** route 节点解析对话策略时
- **THEN** 它应通过 O(1) 查找将（intent、emotion、relationship）与 15 个硬编码的 ROUTE_RULES 匹配，无需调用 LLM

#### Scenario: Policy lookup

- **WHEN** policy 节点确定回复参数时
- **THEN** 它应根据路由名称查找 10 个硬编码的 POLICY_PACKS（deep_comfort / calm_deescalation / relationship_repair / playful_flirt / light_companion / quiet_presence / practical_support / gentle_clarification / memory_ack / roleplay_flow）

### Requirement: CompanionState Schema

系统应在整个管线生命周期中维护一个 CompanionState 对象，包含核心字段：userId、companionId、conversationId、userMessage、messageCount、safety、intent、emotion、relationship、route、policy、quality、memoryCandidate、extractedMemories、summary、assistantReply、partialTokens、existingMemories、recentMessages、feedbacks、lastFallback。

证据来源：
- `packages/server/src/modules/companion/langgraph/interfaces.ts`
- `packages/server/src/modules/companion/langgraph/graph.ts`

#### Scenario: State field lifecycle

- **WHEN** 管线中的每个节点执行时
- **THEN** 它应将输出写入 CompanionState 中对应的字段，通过 LangGraph 的状态传播机制使其对所有下游节点可用

#### Scenario: messageCount 累计语义

- **WHEN** prepareContext 完成本轮用户消息落库后
- **THEN** `state.messageCount` MUST 为会话累计消息数（含本轮 user），MUST NOT 用 `recentMessages.length` 冒充累计数
- **AND** relationship 节点 Prompt 注入 MUST 使用该累计数

#### Scenario: NodeExecutionContext injection

- **WHEN** 图被调用时
- **THEN** 伴侣配置文件（name、personality、tone、boundaries、guardrails、defaultPrompt）应通过 LangGraph 的 `configurable` / NodeExecutionContext 通道注入，而非作为状态字段

### Requirement: Safety Interrupt in Pipeline Service

外部管线编排器应监控 LangGraph 流，并在安全边界被触发时中止执行。

证据来源：
- `packages/server/src/modules/companion/companion-chat-pipeline.service.ts#L84-L108`

#### Scenario: Safety-driven stream termination

- **WHEN** 管线服务在流式状态补丁中检测到 `boundaryAction === 'refuse'` 或 `'crisis_support'`
- **THEN** 它应跳出流循环，产生 `{ patch, safetyBlocked: true, safetyReason }`，且不持久化助手消息

#### Scenario: Normal completion

- **WHEN** 流在没有安全中断的情况下完成
- **THEN** 管线服务应验证 7 个关键状态字段（safety、intent、emotion、route、policy、quality、assistantReply），持久化记忆，并保存助手消息

### Requirement: LangChain ChatOpenAI 适配层

Companion 的 LLM 调用 SHALL 通过 LangChain ChatOpenAI 适配层完成，MUST 使用 StructuredOutputService 提供的三方法降级链确保结构化输出可靠性。

证据来源：
- `packages/server/src/modules/companion/langchain/langchain-llm.service.ts`
- `packages/server/src/modules/companion/langchain/structured-output.service.ts`
- `packages/server/src/modules/companion/langgraph/nodes/_shared.ts#L26-L49`

#### Scenario: LLM 适配层分工

- **WHEN** 系统需要调用 LLM 时
- **THEN** Companion 使用 LangChain ChatOpenAI（需要 `withStructuredOutput()`），Chat 使用 LlamaIndex LlamaIndexProvider（仅需 streaming），RAG 使用 LlamaIndex OpenAIEmbedding 适配器（Embedding 生成）

#### Scenario: 统一 LLM 调用入口

- **WHEN** LangGraph 节点需要调用 LLM 进行结构化输出时
- **THEN** 节点通过 `SharedNodeFactory.invokeStructured<T>(schema, config, fallback, state, ctx)` 统一调用：buildVariables → prompt.invoke → StructuredOutputService.invokeWithFallback → 成功返回 T，失败返回 fallback 保证管线不中断

### Requirement: StructuredOutput 三方法降级链

系统 SHALL 实现结构化输出的三种方法自动降级，确保不同 LLM API 类型下的兼容性，MUST 在每种方法后执行 Zod 二次校验。

证据来源：
- `packages/server/src/modules/companion/langchain/structured-output.service.ts`

#### Scenario: chat_completions API 降级顺序

- **WHEN** 使用 OpenAI chat_completions API 时
- **THEN** 系统按 `functionCalling → jsonSchema → jsonMode` 顺序尝试，每个方法通过 `model.withStructuredOutput(schema, {name, method}).invoke(prompt)` 执行

#### Scenario: responses API 降级顺序

- **WHEN** 使用 OpenAI responses API 时
- **THEN** 系统按 `jsonSchema → functionCalling → jsonMode` 顺序尝试

#### Scenario: Zod 二次校验

- **WHEN** 每种方法返回结果后
- **THEN** 系统 SHALL 通过 `schema.parse(result)` 执行 Zod 二次校验，确保 LLM 输出的类型和结构完全符合预期

#### Scenario: 全失败降级

- **WHEN** 所有三种方法均失败
- **THEN** 系统抛 `InternalServerErrorException`；temperature 固定为 0（结构化输出必须是确定性的）

### Requirement: LlmConfigService 配置热更新

系统 SHALL 通过事件驱动机制支持 Companion LLM 配置的热更新，MUST 在配置变更时自动重建 ChatOpenAI 实例。

证据来源：
- `packages/server/src/modules/companion/config/llm-config.service.ts`

#### Scenario: 配置初始化链

- **WHEN** LlmConfigService 创建 LangChain ChatOpenAI 实例时
- **THEN** 系统执行配置链：`SystemConfigService.getDecryptedSystemConfig()` → `settings.companion.provider`（`{providerId}#{modelName}` 格式）→ `ModelProviderService.resolveProvider("companion.provider", "llm")` → `ResolvedProvider{apiKey, model, baseURL, isCompleteUrl, timeoutMs}` → `resolveLlmBaseURL()` → `new ChatOpenAI(...)`

#### Scenario: 配置热更新

- **WHEN** 系统配置发生变更（`config.changed` 事件）且变更分类为 `companion` 或 `providers` 时
- **THEN** 系统自动重建 LangChain ChatOpenAI 实例，无需重启服务

#### Scenario: 未配置 Provider

- **WHEN** Companion LLM Provider 未配置时
- **THEN** 系统抛 `MODEL_PROVIDER_ERROR_CODES.NOT_CONFIGURED` 错误

### Requirement: 核心常量约束

系统 SHALL 使用以下常量约束 Companion 对话的上下文窗口和记忆容量：

证据来源：
- `packages/server/src/modules/companion/langchain/constants.ts`

#### Scenario: 上下文窗口限制

- **WHEN** 构建 LLM 调用上下文时
- **THEN** 系统限制最近消息注入数量为 RECENT_MESSAGE_LIMIT=18，记忆注入条数为 MEMORY_INJECTION_LIMIT=12，反馈注入条数为 MESSAGE_FEEDBACK_INJECTION_LIMIT=8

#### Scenario: 摘要长度限制

- **WHEN** 生成对话摘要时
- **THEN** CONVERSATION_SUMMARY_MAX_LENGTH 限制为 1600 字符

### Requirement: Route Rules 三维度匹配规则结构

RouteNode SHALL 作为纯规则引擎，通过三维度元组匹配确定对话路线和响应行为标志，MUST 零 LLM 成本，MUST 输出六个字段。

证据来源：
- `d:\projects\ai-stared-project\knowledge-base\.trellis\spec\server\backend\companion-pipeline.md`（Route Rules 章节）
- `packages/server/src/modules/companion/langgraph/nodes/route-node.ts#L27-L178`

#### Scenario: 三维度匹配输入

- **WHEN** route 节点解析对话策略时
- **THEN** 系统 SHALL 接收三个维度作为匹配输入：`intent`（用户意图类别，如 emotional_support/casual_chat/question）、`emotion`（检测到的用户情绪，如 sad/anxious/happy/neutral）、`relationship`（当前关系阶段，如 trusted_companion/building_trust）

#### Scenario: 六字段规则输出

- **WHEN** 三维度元组匹配到 15 条硬编码 ROUTE_RULES 之一时
- **THEN** 系统 SHALL 输出六个字段：`route`（策略名称，如 deep_comfort/light_companion）、`responseLength`（short/medium/long）、`shouldAskQuestion`（boolean）、`shouldShareExperience`（boolean）、`shouldUseNickname`（boolean）、`shouldUseMemory`（boolean）

#### Scenario: 确定性规则匹配

- **WHEN** 相同的 (intent, emotion, relationship) 输入
- **THEN** 系统 MUST 返回相同的路由结果，因为规则匹配是确定性的 O(1) 查找，不依赖 LLM 推理

### Requirement: Policy Packs 策略包字段结构

PolicyNode SHALL 作为纯查找表，MUST 将路由名称映射到包含九个字段的详细回复策略，MUST 零 LLM 成本。

证据来源：
- `d:\projects\ai-stared-project\knowledge-base\.trellis\spec\server\backend\companion-pipeline.md`（Policy Packs 章节）
- `packages/server/src/modules/companion/langgraph/nodes/policy-node.ts#L30-L199`

#### Scenario: 九字段策略包定义

- **WHEN** policy 节点根据 route 名称查找 10 个 POLICY_PACKS 之一时
- **THEN** 系统 MUST 返回包含九个字段的策略包：`sentenceBudget`（响应最大句子数）、`rhythm`（响应节奏，如 pause_and_reflect/quick_back_and_forth）、`openingMove`（响应开始方式）、`allowedMoves`（允许的对话策略）、`forbiddenMoves`（禁止的策略）、`questionLimit`（每个响应最大问题数）、`adviceLimit`（最大建议数量）、`intimacyLevel`（low/medium/high）、`styleGuidance`（语气和风格指导）

#### Scenario: 十个策略包覆盖

- **WHEN** 系统初始化策略包时
- **THEN** 系统 SHALL 提供十个策略包覆盖所有对话场景：deep_comfort（深度情感慰藉）、calm_deescalation（焦虑缓解）、relationship_repair（冲突修复）、playful_flirt（轻松俏皮）、light_companion（日常陪伴）、quiet_presence（静默陪伴）、practical_support（实用建议）、gentle_clarification（温和澄清）、memory_ack（记忆确认）、roleplay_flow（角色扮演）

### Requirement: Prompt Injection Chain

LangChain PromptTemplates SHALL 以链式方式连接，每个节点的输出 MUST 作为上下文变量注入到后续节点的 Prompt 中，确保下游节点感知上游判断结果。

证据来源：
- `d:\projects\ai-stared-project\knowledge-base\.trellis\spec\server\backend\companion-pipeline.md`（Prompt Injection Chain 章节）
- `packages/server/src/modules/companion/langgraph/nodes/safety-node.ts`、`intent-node.ts`、`emotion-node.ts`、`relationship-stage-node.ts`

#### Scenario: 链式上下文注入

- **WHEN** 管线执行 safety、intent、emotion、relationship 节点时
- **THEN** 系统 SHALL 按链式顺序注入上下文：safety 节点独立执行输出 safetyResult；intent 节点注入 { safety: safetyResult } 输出 intentResult；emotion 节点注入 { safety, intent } 输出 emotionResult；relationship 节点注入 { safety, intent, emotion, messageCount, summary } 输出 relationshipResult

#### Scenario: PromptTemplates 数量

- **WHEN** 系统初始化 prompts.ts 时
- **THEN** 系统 MUST 定义六个 PromptTemplates：safety、intent、emotion、relationshipStage、memoryCandidate、memoryExtraction

### Requirement: Memory Keyword Fallback

系统 SHALL 通过正则表达式关键词触发器强制进行记忆提取，MUST 在用户输入匹配关键词时绕过 LLM 判断，确保显式记忆命令不被遗漏。

证据来源：
- `d:\projects\ai-stared-project\knowledge-base\.trellis\spec\server\backend\companion-pipeline.md`（Memory Keyword Fallback 章节）
- `packages/server/src/modules/companion/langgraph/nodes/memory-candidate-node.ts#L15-L16`

#### Scenario: 关键词正则匹配

- **WHEN** memory_candidate 节点接收用户输入时
- **THEN** 系统 MUST 使用正则模式 `记住|以后|别再|我喜欢|我讨厌|我的.*是|总是` 匹配用户输入

#### Scenario: 强制记忆提取

- **WHEN** 用户输入匹配任一关键词时
- **THEN** 系统 SHALL 强制将 `shouldExtract` 设为 `true`，绕过 LLM 判断，确保 memory_extraction 节点必须执行

#### Scenario: 无关键词时正常 LLM 判断

- **WHEN** 用户输入不匹配任何关键词时
- **THEN** 系统 SHOULD 由 LLM 判断是否需要提取记忆（shouldExtract 由 LLM 决定）

### Requirement: SharedNodeFactory 节点回退值表

所有调用 LLM 的节点 SHALL 通过 SharedNodeFactory.invokeStructured 统一入口，MUST 在 LLM 失败时返回预定义回退值而非抛出异常，确保 pipeline 不中断。

证据来源：
- `d:\projects\ai-stared-project\knowledge-base\.trellis\spec\server\backend\companion-pipeline.md`（Shared LLM Node Factory 章节）
- `packages/server/src/modules/companion/langgraph/nodes/_shared.ts#L26-L49`

#### Scenario: 七节点回退值定义

- **WHEN** LLM 调用失败时
- **THEN** 系统 MUST 按节点返回预定义回退值：safety 返回默认安全结果；intent 返回 `casual_chat`；emotion 返回 `neutral`；relationship 保留当前阶段；summary 保留前一个摘要；memoryCandidate 返回 `shouldExtract: false`；memoryExtraction 返回空记忆列表

#### Scenario: 管线容错保证

- **WHEN** 任一 LLM 节点发生异常时
- **THEN** 系统 SHALL 通过回退值继续执行下游节点，MUST 不因 LLM 异常停止 pipeline

### Requirement: Memory 类型分类

Companion 记忆系统 SHALL 支持五种记忆类型分类，MUST 在记忆管理页面为每种类型提供中文标签。

证据来源：
- `d:\projects\ai-stared-project\knowledge-base\.trellis\spec\web\frontend\companion-ui-rendering.md`（Memory 类型 章节）
- `packages/web/src/features/companion/types.ts`

#### Scenario: 五种记忆类型

- **WHEN** 系统定义 MemoryType 时
- **THEN** 系统 MUST 支持五种类型：`preference`（偏好）、`boundary`（边界）、`relationship_goal`（关系目标）、`conversation_style`（对话风格）、`important_fact`（重要事实）

#### Scenario: 中文标签映射

- **WHEN** 前端渲染记忆管理页面时
- **THEN** 系统 SHALL 通过 MEMORY_TYPE_LABELS 映射提供中文标签：preference→偏好、boundary→边界、relationship_goal→关系目标、conversation_style→对话风格、important_fact→重要事实

### Requirement: 伴侣创建/编辑表单字段与入口

Companion 创建/编辑 MUST 提供完整人设字段集合，**主路径为独立路由页**（非仅 Dialog）；MUST 支持 create/edit 双模式；SHALL 对文本字段执行空白清理。人设拼接与头像细则见 capability **`companion-persona`**（创建后由服务端写入 `defaultPrompt`）。

证据来源：
- `packages/web/src/features/companion/components/CompanionFormPage.tsx`
- `packages/server/src/modules/companion/companion.service.ts`

#### Scenario: 核心属性字段

- **WHEN** 定义伴侣数据模型时
- **THEN** 系统 MUST 包含以下字段：`name`（伴侣名称，必填）、`headline`（副标题/一句话介绍）、`description`（详细描述）、`personality`（性格设定）、`tone`（语气风格）、`boundaries`（行为边界）、`guardrailsPrompt`（安全约束提示词）、`defaultPrompt`（默认系统提示词，服务端多节拼接权威）、`backgroundStory`（背景故事）、`openingMessage`（开场白）、`avatarKey`（头像标识）、`visibility`（可见性设置）

#### Scenario: 字段提交处理

- **WHEN** 用户提交伴侣信息时
- **THEN** 系统 SHALL 对文本字段执行空白清理，空字符串视为未设置

#### Scenario: 双模式操作

- **WHEN** 创建或编辑伴侣时
- **THEN** 系统 MUST 支持创建模式（新增伴侣）和编辑模式（修改已有伴侣），MUST 在操作成功后给出明确反馈
- **AND** 列表「新建/编辑」MUST 进入独立页面级表单（`/companions/new`、`/companions/:id/edit`）

### Requirement: Companion 前端功能范围

Companion 前端模块 SHALL 覆盖伴侣生命周期管理、AI SDK 流式对话、记忆管理与主动关怀配置；MUST 与 Knowledge Chat 客户端栈隔离（Knowledge 主路径可继续使用 ant-design/x，本能力不强制迁移）。

证据来源：
- `packages/web/src/features/companion/`

#### Scenario: 列表与管理

- **WHEN** 用户进入 Companion 模块时
- **THEN** 系统 SHALL 提供伴侣列表浏览能力，MUST 提供创建新伴侣入口，MUST 能区分 draft/published/archived 状态

#### Scenario: 创建与编辑

- **WHEN** 用户创建或编辑伴侣时
- **THEN** 系统 SHALL 提供完整人设表单（见 capability **companion-persona**），MUST 支持头像上传主路径与 defaultPrompt 预览/生成反馈
- **AND** 列表「新建/编辑」MUST 进入独立页面级表单（`/companions/new`、`/companions/:id/edit`）

#### Scenario: AI SDK 流式对话

- **WHEN** 用户与伴侣对话时
- **THEN** 系统 MUST 使用 Vercel AI SDK（如 `useChat`）作为 Companion 聊天客户端
- **AND** MUST 通过自定义 Transport（`CompanionChatTransport`）消费 Nest Companion 既有 SSE 事件
- **AND** MUST NOT 要求将 Knowledge Chat 改为 AI SDK

#### Scenario: 记忆管理

- **WHEN** 用户管理伴侣记忆时
- **THEN** 系统 SHALL 提供记忆列表、类型筛选、编辑/删除或状态变更能力，MUST 覆盖五种 MemoryType

#### Scenario: 主动关怀入口

- **WHEN** 用户配置伴侣主动关怀时
- **THEN** 系统 SHALL 在伴侣上下文提供 Care Plan 配置与手动生成入口（见 capability **companion-care**）

### Requirement: Companion SSE 流式语义

Companion 对话 SHALL 以流式方式呈现助手回复；**服务端**保持 Companion SSE 事件契约；**客户端**通过 AI SDK Transport 映射事件，MUST 支持打字机体感并在完成后固化消息。

证据来源：
- `packages/server/src/modules/companion/companion-chat-stream.service.ts`
- `packages/server/src/modules/companion/companion-sse.events.ts`
- `packages/web/src/features/companion/companion-chat-transport.ts`

#### Scenario: 业务分轨理由

- **WHEN** 为对话模块选择传输方案时
- **THEN** Companion MUST 保持与 Knowledge Chat 独立的服务端流契约与产品定位（情感陪伴/打字机体感）
- **AND** Companion Web 客户端 MUST 使用 AI SDK，Knowledge Chat MUST NOT 被本能力强制迁移

#### Scenario: 服务端流式事件类型

- **WHEN** 服务端推送 Companion 流时
- **THEN** 系统 MUST 至少支持 `token`（增量文本）、`done`（结束，含完整回复）、`error`（错误码与消息）事件
- **AND** SHOULD 支持 `summary`、`memories`、`heartbeat` 等侧车事件供客户端副作用处理

#### Scenario: Transport 映射

- **WHEN** AI SDK Transport 接收 SSE 事件时
- **THEN** 系统 MUST 将 `token` 映射为助手消息文本增量，将 `done` 映射为消息完成，将 `error` 映射为可展示错误
- **AND** MUST NOT 在请求体中注入用户私有 LLM API Key

#### Scenario: 流式状态与错误恢复

- **WHEN** 流式过程中发生网络错误或服务端错误时
- **THEN** 系统 SHALL 向用户显示错误提示，MUST 保留已接收的部分内容（若协议允许），SHOULD 提供重试入口

#### Scenario: 助手落库先于 done

- **WHEN** 本轮产生非空助手回复并准备结束流时
- **THEN** 服务端 MUST 先持久化助手消息（含 metadata 快照），再推送 `done` 事件
- **AND** 以便客户端收到完成时历史已可读，并避免连发时 `findRecent` 缺上轮助手

### Requirement: 行为权威与参考实现对齐

在 Companion 情感产品范围内，系统行为 MUST 与 ai-partner-agent 参考实现的产品语义对齐；实现结构 MUST 保留 GoferBot（11 节点 Graph、Prisma 字段名、服务端 LLM 配置、现 SSE）。冲突时按「行为 > 结构」裁决，并回写 OpenSpec。

#### Scenario: 差距矩阵驱动实现

- **WHEN** 实现或回归 Companion 行为对齐工作时
- **THEN** 工程 MUST 维护可执行差距矩阵（参考能力 → GoferBot 状态 → 测试 ID）
- **AND** 关闭差距项 MUST 有对应自动化测试或明确 E2E 场景

#### Scenario: 不对齐项显式记录

- **WHEN** 某项故意不对齐参考实现（如浏览器注入 API Key、群聊、Cron 关怀）时
- **THEN** 该项 MUST 记录在 Non-Goals 或差距矩阵的「明确不做」列，MUST NOT 静默漂移

### Requirement: 用户消息先落库（设计 A）

发送消息管线在进入 LangGraph 前 MUST 先持久化本轮用户消息并递增会话 `messageCount`；成功路径再落库助手消息；安全硬中断/管线失败时允许仅保留 user 的半会话。门闸失败（archived / not found）MUST NOT 落库用户消息。

证据来源：
- `packages/server/src/modules/companion/companion-chat-pipeline.service.ts`（prepareContext）
- `packages/server/src/modules/companion/companion-chat-stream.service.ts`

#### Scenario: 先加载历史再写 user

- **WHEN** prepareContext 构建本轮 initialState 时
- **THEN** 系统 MUST 先加载 `recentMessages`（不含本轮 user），再落库本轮 user
- **AND** 本轮正文仅出现在 `state.userMessage`，MUST NOT 同时出现在 `recentMessages` 中造成重复

#### Scenario: 成功路径双落库

- **WHEN** 管线成功产生非空助手回复时
- **THEN** 系统 MUST 已持久化 user，并再持久化 assistant（含 metadata）
- **AND** 会话 `messageCount` 最终 MUST 反映 user + assistant 各 +1

#### Scenario: 安全中断半会话

- **WHEN** safety 硬中断且 prepareContext 已成功时
- **THEN** 系统 MUST 保留已落库的 user 消息，MUST NOT 持久化正常情感向助手回复
- **AND** 客户端收到明确 safety/error 事件

#### Scenario: archived 门闸无脏写

- **WHEN** 伴侣状态为 `archived` 时
- **THEN** 系统 MUST 在用户消息落库前拒绝请求，会话 MUST NOT 新增脏消息

### Requirement: 历史反馈加载与 Prompt 注入

管线准备上下文时 MUST 加载当前会话/伴侣相关的历史消息反馈并写入 `CompanionState.feedbacks`；generate 阶段 MUST 将反馈注入 system prompt；前端 MUST 支持赞踩并可选填写 reason/note。

证据来源：
- `packages/server/src/modules/companion/companion-chat-pipeline.service.ts`
- `packages/server/src/modules/companion/langgraph/nodes/generate-node.ts`
- `packages/server/src/modules/companion/repositories/companion-feedback.repository.ts`

#### Scenario: 反馈不得空置

- **WHEN** 用户对历史助手消息存在已持久化反馈且管线开始新一轮生成时
- **THEN** `state.feedbacks` MUST 包含在注入限额内的反馈条目，MUST NOT 无条件使用空数组

#### Scenario: 注入限额

- **WHEN** 可注入反馈数量超过 `MESSAGE_FEEDBACK_INJECTION_LIMIT`（默认 8）时
- **THEN** 系统 MUST 仅注入限额内条目（按更新时间或约定排序）

#### Scenario: 前端提交反馈

- **WHEN** 用户对助手消息点赞或点踩时
- **THEN** 系统 MUST 持久化 rating，SHOULD 允许 reason/note
- **AND** 历史消息加载 MUST 能反映已有反馈状态

#### Scenario: 反馈 rating 规范枚举

- **WHEN** 客户端提交或服务端持久化消息反馈时
- **THEN** 持久化层 MUST 使用稳定枚举 `positive` | `negative`（与 Prisma `FeedbackRating` 一致）
- **AND** HTTP API 请求/响应 MUST 使用同一枚举字符串，MUST NOT 混用未文档化的 `up`/`down` 或裸 `1`/`-1` 作为契约主类型
- **AND** 若 UI 内部暂用 `up`/`down`，MUST 仅在客户端映射层转换，不得泄漏为 OpenAPI/DTO 主字段类型

### Requirement: 助手消息 Pipeline Metadata

持久化助手消息时 MUST 写入结构化 metadata 快照（至少含 quality，并应含 safety/intent/emotion/relationship/route 等已产出字段的摘要）；完整 system prompt 默认 MUST NOT 写入 metadata。

证据来源：
- `packages/server/prisma/schema.prisma`（CompanionMessage.metadata）
- `packages/server/src/modules/companion/companion-chat-pipeline.service.ts`（buildPipelineMetadataSnapshot / persistAssistantMessage）

#### Scenario: 落库快照

- **WHEN** 一轮对话成功产生助手回复并落库时
- **THEN** 消息记录 MUST 含 content 与 metadata JSON 快照，metadata MUST 可被测试解析断言

#### Scenario: 用户 UI 不展示原始分析

- **WHEN** 用户在聊天界面查看消息时
- **THEN** 系统 MUST NOT 默认展示完整 pipeline 分析 JSON 作为气泡正文

### Requirement: 伴侣状态对聊天的约束

Companion `status` MUST 约束是否允许发送新消息：`draft` 与 `published` 允许所有者聊天；`archived` 禁止发送。

#### Scenario: draft 可调试聊天

- **WHEN** 伴侣状态为 `draft` 且请求者为所有者时
- **THEN** 系统 MUST 允许进入对话管线

#### Scenario: archived 禁止发送

- **WHEN** 伴侣状态为 `archived` 且用户尝试发送新消息时
- **THEN** 系统 MUST 拒绝请求并返回明确错误（如 `ERR_COMPANION_ARCHIVED`）

### Requirement: 服务端 LLM 配置权威

Companion 管线 LLM 调用 MUST 仅通过服务端配置解析（LlmConfigService / companion.provider 链路）；MUST NOT 要求或信任浏览器提交的 API Key 作为主配置源。

#### Scenario: 无浏览器 Key

- **WHEN** 客户端发起 Companion 流式聊天请求时
- **THEN** 服务端 MUST 使用已配置的服务端凭据与模型解析结果调用 LLM
- **AND** MUST NOT 将客户端传入的 apiKey 作为默认生产路径

### Requirement: 近期消息窗口语义

`findRecent` MUST 取会话**最近** `RECENT_MESSAGE_LIMIT`（默认 18）条消息，并按时间正序返回供 prompt 注入；MUST NOT 使用 `orderBy asc + take`（那是最旧 N 条）。

#### Scenario: 最新窗口正序

- **WHEN** 构建 `state.recentMessages` 时
- **THEN** 系统 MUST 按 createdAt/id 降序 take 后 reverse 为正序
- **AND** 窗口长度 MUST NOT 超过 `RECENT_MESSAGE_LIMIT`

### Requirement: 记忆运行时与管理

记忆抽取 MUST 保持三级过滤语义（规则快速跳过 → 候选判断 → 抽取）；注入 MUST 遵守 `MEMORY_INJECTION_LIMIT`（默认 12）与按 importance 等约定排序；类型 MUST 为五种 MemoryType。管理面 MUST 支持按伴侣列出、更新内容/importance/status、删除（软删）。

#### Scenario: 注入限额

- **WHEN** 活跃记忆超过 `MEMORY_INJECTION_LIMIT` 时
- **THEN** 注入 system prompt 的记忆条数 MUST NOT 超过该限额

#### Scenario: 管理 API

- **WHEN** 所有者管理记忆时
- **THEN** 系统 MUST 支持 `GET` 列表（可按 type 筛选）、`PATCH` 更新、`DELETE` 软删
- **AND** 非所有者 MUST 收到拒绝（如 403）

#### Scenario: 管理 UI

- **WHEN** 用户打开记忆管理页时
- **THEN** 系统 MUST 支持类型筛选与编辑/删除或状态切换至少一种写操作
