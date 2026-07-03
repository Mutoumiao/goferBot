# Companion - AI 伴侣对话

## Purpose（目的）

定义 GoferBot AI 伴侣（Companion）的对话管线系统级规范。覆盖 LangGraph 状态图结构、节点执行顺序、条件路由、LLM 调用约束、安全中断机制、LangChain 适配层（StructuredOutput 降级链 + LlmConfigService 热更新）。

## Requirements（需求）

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
- **THEN** 系统执行配置链：`SystemConfigService.getDecryptedSystemConfig()` → `settings.companion.provider` → `ModelProviderService.resolveProvider("companion.provider", "llm")` → `{apiKey, model, baseURL, timeoutMs}` → `new ChatOpenAI(...)`

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
