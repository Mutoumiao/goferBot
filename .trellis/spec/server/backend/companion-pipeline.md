# Companion Pipeline 开发指南

> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为 [openspec/specs/companion/spec.md](../../../../openspec/specs/companion/spec.md)（WHAT）。Route Rules / Policy Packs / Prompt Chain / Memory Fallback / LLM Call Budget / 节点回退值 / StateGraph 状态字段 / Memory 类型 应以 OpenSpec 为准。

---

## Purpose

帮助开发者在 Companion LangGraph pipeline 中高效工作：理解节点实现模式、调试技巧、回退策略与常见陷阱，避免重复踩坑。本指南不重复业务规则，仅记录开发智慧。

## Primary OpenSpec

- [openspec/specs/companion/spec.md](../../../../openspec/specs/companion/spec.md) — Companion 对话管线系统级规范（节点顺序、条件分支、LLM 预算、CompanionState Schema、安全中断）

## Related OpenSpec

- [openspec/specs/chat/spec.md](../../../../openspec/specs/chat/spec.md) — Chat SSE 双轨方案（streamMode 消费者契约）
- [openspec/specs/settings/spec.md](../../../../openspec/specs/settings/spec.md) — LLM Provider 配置（LlmConfigService 热更新源）

## Module Dependencies

- **LangChain 1.x** — ChatOpenAI 适配层，`withStructuredOutput` 提供结构化输出与降级链
- **LangGraph** — StateGraph 状态机，`streamMode: 'updates'` 产出逐节点状态补丁
- **Zod** — 结构化输出 Schema 校验
- **@goferbot/data** — CompanionState Schema 与共享类型

## Development Entry

- `packages/server/src/modules/companion/langgraph/graph.ts` — StateGraph 定义、节点拓扑、条件边
- `packages/server/src/modules/companion/langgraph/nodes/` — 11 个节点实现
- `packages/server/src/modules/companion/langgraph/prompts.ts` — 6 个 PromptTemplates
- `packages/server/src/modules/companion/langgraph/nodes/_shared.ts` — SharedNodeFactory 统一调用入口
- `packages/server/src/modules/companion/langgraph/interfaces.ts` — CompanionState 与节点 IO 类型

## Implementation Notes

- **SharedNodeFactory.invokeStructured 统一调用模式**：所有调 LLM 的节点走同一条路径 `buildVariables → prompt.invoke → invokeWithFallback → fallback`。新增节点不要自己 `await llm.invoke(...)`，必须走工厂方法，否则会丢失回退保障与日志一致性。
- **LLM 失败不抛错**：工厂方法在 LLM 失败时返回 `fallback` 而非抛异常，确保 pipeline 不因单节点 LLM 故障中断。回退值的具体定义见 OpenSpec。
- **LangGraph streamMode 调试**：消费端用 `streamMode: 'updates'` 观察逐节点状态补丁。调试时可在每个节点末尾打日志确认 `lastFallback` 标记，区分 LLM 成功路径与回退路径。
- **withStructuredOutput method 选择**：优先 `method: 'functionCall'`（OpenAI 原生 function calling），降级到 `method: 'jsonMode'`。不要默认使用 `jsonSchema` 模式，部分 Provider 不支持。
- **temperature 固定为 0**：所有结构化输出节点 temperature=0，保证分类结果（safety/intent/emotion/relationship）可复现。生成节点单独配置。
- **LlmConfigService 热更新调试**：配置变更通过事件总线广播。若发现 LLM 行为未随配置更新变化，检查事件订阅是否在模块初始化时绑定，而非请求时绑定。
- **纯规则引擎节点模式**：Route / Policy / QualityGuard 节点零 LLM 成本，使用 O(1) 查找表。新增此类节点时禁止引入 LLM 调用，否则会破坏 LLM Call Budget 约束。
- **Prompt 变量注入顺序**：下游节点的 PromptTemplate 通过上下文变量注入上游节点输出。变量名必须与 `buildVariables` 返回的 key 完全一致，否则静默渲染为空字符串而非报错。
- **Memory 关键词回退模式**：基于正则的关键词触发器可强制开启记忆提取，绕过 LLM 判断。这是显式用户命令（"记住"/"以后"）的兜底，正则模式定义见 OpenSpec。

## Testing Checklist

- [ ] 每个节点单独测试（mock LLM 响应，覆盖成功与失败两条路径）
- [ ] Safety 节点 `refuse` / `crisis_support` 中断测试，验证图立即 END
- [ ] Quality guard 评分低于阈值时丢弃响应，验证 END 而非继续
- [ ] Memory extraction 条件跳过测试（`shouldExtract === false` 时不调 LLM）
- [ ] LLM 失败时回退值正确性测试（每个节点独立验证 fallback 字段）
- [ ] StateGraph 状态传播正确性测试（上游节点输出可被下游节点读取）
- [ ] 纯规则节点零 LLM 调用测试（断言 mock LLM 未被调用）
- [ ] `streamMode: 'updates'` 流式补丁顺序与节点执行顺序一致

## Review Checklist

- [ ] 新节点是否通过 SharedNodeFactory 调用 LLM（禁止裸 `llm.invoke`）
- [ ] 新 Route 规则是否同步更新 OpenSpec（ROUTE_RULES 表）
- [ ] 新 Policy Pack 是否同步更新 OpenSpec（POLICY_PACKS 表）
- [ ] temperature 是否固定为 0（结构化输出节点）
- [ ] 新增回退值是否在 OpenSpec 中记录
- [ ] 新增 LLM 调用是否超出 LLM Call Budget（每轮 7 次上限）
- [ ] Prompt 变量名与 `buildVariables` key 是否完全一致
- [ ] 纯规则节点是否误引入 LLM 调用

## Common Pitfalls

- **LLM 超时未设回退导致管线中断**：忘记传 `fallback` 参数给 `invokeStructured`，LLM 超时后整条 pipeline 崩溃。必须为每个 LLM 节点定义回退值。
- **Prompt 变量注入顺序错误**：下游节点引用了上游尚未产出的字段，渲染为空字符串但不报错。用 `lastFallback` 日志区分是 LLM 失败还是变量缺失。
- **纯规则节点误用 LLM**：在 Route/Policy/QualityGuard 中"顺手"调一次 LLM 做兜底，破坏 LLM Budget 并引入非确定性。规则缺失应补规则表，而非调 LLM。
- **withStructuredOutput 默认 method 不兼容**：未显式指定 `method` 时部分 Provider 报错或返回非结构化文本。始终显式指定 `functionCall` 或 `jsonMode`。
- **热更新事件未订阅**：LlmConfigService 配置变更后行为不变，通常是事件订阅在请求时绑定而非模块初始化时绑定，导致新配置未生效。
- **条件分支遗漏 END**：新增条件终止分支时忘记连接到 END 节点，导致图执行到死胡同或继续走默认路径。

## Reusable Patterns

- **SharedNodeFactory 统一 LLM 调用模式** — 11 个节点共用一个工厂方法，统一错误处理、回退、日志、降级链。新增 LLM 节点直接复用。
- **纯规则引擎节点模式** — O(1) 查找表替代 LLM 分类，零成本、确定性、可测试。适用于输入维度有限、规则可枚举的决策点。
- **事件驱动配置热更新** — LlmConfigService 通过事件总线广播配置变更，节点订阅事件而非每次请求读取，避免缓存陈旧。
- **关键词回退绕过 LLM** — 正则匹配强制触发特定行为（如记忆提取），作为 LLM 判断的兜底，确保显式用户命令不被遗漏。
- **Prompt 变量链式注入** — 上游节点输出作为下游 Prompt 的上下文变量，通过 `buildVariables` 统一构建，避免散落的字符串拼接。
