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

系统应在 StateGraph 管线中支持三个条件终止分支。

证据来源：
- `packages/server/src/modules/companion/langgraph/graph.ts#L164-L219`

#### Scenario: Safety block termination

- **WHEN** safety 节点输出的 `boundaryAction` 等于 `'refuse'` 或 `'crisis_support'`
- **THEN** 图应立即终止（END），返回包含 `safetyReason` 的 `safetyBlocked` 响应

#### Scenario: Quality check failure termination

- **WHEN** quality guard 节点对生成的响应评分低于阈值（`shouldPass === false`）
- **THEN** 图应终止（END），丢弃低质量响应

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

系统应在整个管线生命周期中维护一个 CompanionState 对象，包含以下 20 个字段：userId、companionId、conversationId、userMessage、safety、intent、emotion、relationship、route、policy、quality、memoryCandidate、extractedMemories、summary、assistantReply、partialTokens、existingMemories、recentMessages、feedbacks、lastFallback。

证据来源：
- `packages/server/src/modules/companion/langgraph/interfaces.ts#L327-L361`
- `packages/server/src/modules/companion/langgraph/graph.ts#L18-L39`

#### Scenario: State field lifecycle

- **WHEN** 管线中的每个节点执行时
- **THEN** 它应将输出写入 CompanionState 中对应的字段，通过 LangGraph 的状态传播机制使其对所有下游节点可用

#### Scenario: NodeExecutionContext injection

- **WHEN** 图被调用时
- **THEN** 伴侣配置文件（name、personality、tone、boundaries、guardrails）应通过 LangGraph 的 `configurable` 通道注入，而非作为状态字段

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

### Requirement: CompanionForm 表单字段定义

Companion 创建/编辑表单 SHALL 定义完整的伴侣属性字段集合，MUST 支持创建与编辑双模式，SHALL 对文本字段执行空白清理。

证据来源：
- `packages/web/src/features/companion/components/CompanionForm.tsx`
- `packages/server/src/modules/companion/`

#### Scenario: 核心属性字段

- **WHEN** 定义伴侣数据模型时
- **THEN** 系统 MUST 包含以下字段：`name`（伴侣名称，必填）、`headline`（副标题/一句话介绍）、`description`（详细描述）、`personality`（性格设定）、`tone`（语气风格）、`boundaries`（行为边界）、`guardrailsPrompt`（安全约束提示词）、`defaultPrompt`（默认系统提示词）、`backgroundStory`（背景故事）、`openingMessage`（开场白）、`avatarKey`（头像标识）、`visibility`（可见性设置）

#### Scenario: 字段提交处理

- **WHEN** 用户提交伴侣信息时
- **THEN** 系统 SHALL 对文本字段执行空白清理，空字符串视为未设置

#### Scenario: 双模式操作

- **WHEN** 创建或编辑伴侣时
- **THEN** 系统 MUST 支持创建模式（新增伴侣）和编辑模式（修改已有伴侣），MUST 在操作成功后给出明确反馈

### Requirement: Companion 前端功能范围

Companion 前端模块 SHALL 覆盖完整的伴侣生命周期管理与对话交互功能，MUST 支持列表浏览、创建编辑、流式对话、记忆管理四类核心场景。

证据来源：
- `packages/web/src/features/companion/`

#### Scenario: 列表与管理

- **WHEN** 用户进入 Companion 模块时
- **THEN** 系统 SHALL 提供伴侣列表浏览能力，SHOULD 支持卡片式展示，MUST 提供创建新伴侣的入口

#### Scenario: 创建与编辑

- **WHEN** 用户创建或编辑伴侣时
- **THEN** 系统 SHALL 提供表单界面，MUST 覆盖所有核心属性字段，SHALL 支持实时预览

#### Scenario: 流式对话

- **WHEN** 用户与伴侣对话时
- **THEN** 系统 SHALL 提供流式逐字输出能力，MUST 支持打字机动画效果，SHALL 显示伴侣状态标识

#### Scenario: 记忆管理

- **WHEN** 用户管理伴侣记忆时
- **THEN** 系统 SHALL 提供记忆浏览与分类能力，MUST 支持五种记忆类型的区分展示

### Requirement: Companion SSE 流式语义

Companion 对话 SHALL 以流式逐 token 方式呈现助手回复，MUST 支持打字机效果模拟真人输出，SHALL 在流式过程中维护流式状态并在完成后固化消息。

证据来源：
- `packages/web/src/features/companion/sse-client.ts`
- `packages/web/src/features/companion/store.ts`

#### Scenario: 业务分轨理由

- **WHEN** 为对话模块选择 SSE 方案时
- **THEN** Companion MUST 采用纯文本逐字流式输出方案（区别于 Chat 的 Markdown 增量渲染），因为 Companion 定位为情感陪伴，需要打字机动画效果模拟真人对话节奏

#### Scenario: 流式事件类型

- **WHEN** 接收流式响应时
- **THEN** 系统 MUST 区分三类事件：token 事件（增量文本）、done 事件（流式结束）、error 事件（传输错误），MUST 以事件驱动方式处理流式数据

#### Scenario: 流式状态维护

- **WHEN** 流式过程中
- **THEN** 系统 SHALL 维护当前流式内容、消息 ID、流式状态三类数据，MUST 在错误时清空临时流式状态，MUST 在完成时将流式内容固化为正式消息

#### Scenario: 错误恢复

- **WHEN** 流式过程中发生网络错误或服务端错误时
- **THEN** 系统 SHALL 向用户显示错误提示，MUST 保留已接收的部分内容，SHOULD 提供重试入口
