# Companion Pipeline 开发指南

> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为 [openspec/specs/companion/spec.md](../../../../openspec/specs/companion/spec.md)（WHAT）。Route Rules / Policy Packs / Prompt Chain / Memory Fallback / LLM Call Budget / 节点回退值 / StateGraph 状态字段 / Memory 类型 应以 OpenSpec 为准。

---

## Purpose

帮助开发者在 Companion LangGraph pipeline 中高效工作：理解节点实现模式、调试技巧、回退策略与常见陷阱，避免重复踩坑。本指南不重复业务规则，仅记录开发智慧。

## Primary OpenSpec

- [openspec/specs/companion/spec.md](../../../../openspec/specs/companion/spec.md) — Companion 对话管线系统级规范（节点顺序、条件分支、LLM 预算、CompanionState、反馈/metadata/状态门闸）

## Related OpenSpec

- [openspec/specs/companion-persona/spec.md](../../../../openspec/specs/companion-persona/spec.md) — 人设 / defaultPrompt / 头像 / 开场白
- [openspec/specs/companion-care/spec.md](../../../../openspec/specs/companion-care/spec.md) — Care Plan / 手动 generate（**不**走 11 节点主路径）
- [openspec/specs/chat/spec.md](../../../../openspec/specs/chat/spec.md) — Chat SSE 双轨方案（streamMode 消费者契约）
- [openspec/specs/settings/spec.md](../../../../openspec/specs/settings/spec.md) — LLM Provider 配置（LlmConfigService 热更新源）

## Module Dependencies

- **LangChain 1.x** — ChatOpenAI 适配层，`withStructuredOutput` 提供结构化输出与降级链
- **LangGraph** — StateGraph 状态机，`streamMode: 'updates'` 产出逐节点状态补丁
- **Zod** — 结构化输出 Schema 校验
- **@goferbot/data** — CompanionState Schema 与共享类型

## Development Entry

- `packages/server/src/modules/companion/companion-chat-pipeline.service.ts` — **prepareContext / execute / persist** 编排入口
- `packages/server/src/modules/companion/companion-chat-stream.service.ts` — SSE 事件顺序（token → await persist → done）
- `packages/server/src/modules/companion/companion-sse.events.ts` — 服务端事件类型表
- `packages/server/src/modules/companion/langgraph/graph.ts` — StateGraph 定义、节点拓扑、条件边
- `packages/server/src/modules/companion/langgraph/nodes/` — 11 个节点实现
- `packages/server/src/modules/companion/langgraph/prompts.ts` — 6 个 PromptTemplates
- `packages/server/src/modules/companion/langgraph/nodes/_shared.ts` — SharedNodeFactory 统一调用入口
- `packages/server/src/modules/companion/langgraph/interfaces.ts` — CompanionState 与节点 IO 类型
- `packages/server/src/modules/companion/repositories/companion-message.repository.ts` — `findRecent` 最新 N 窗口
- `packages/server/src/modules/companion/companion-care.service.ts` — 关怀（模板生成，不入 Graph）
- `packages/server/src/modules/companion/companion-memory.service.ts` — 记忆 list/PATCH/软删
- 黄金/集成测：`packages/server/tests/modules/companion/`、`tests/integration/companion-*-parity.spec.ts`

## Implementation Notes

### prepareContext 顺序（设计 A）

**顺序不可调乱**：authorize → archived 门闸 → getOrCreate conversation → **并行加载** memories / `findRecent` / feedbacks → **再** `save(user)` → `incrementMessageCount` → 组装 `initialState`。

| 字段 | 来源 | 禁止 |
|------|------|------|
| `userMessage` | 本轮请求正文 | 同时塞进 `recentMessages`（会重复进 prompt） |
| `recentMessages` | 落库 **前** 的最新窗口 | 用 `asc+take` 取「最旧 N 条」 |
| `messageCount` | 落库 user 后的会话累计 | 用 `recentMessages.length` 冒充（窗口≤18 且不含本轮 user） |
| `feedbacks` | FeedbackRepository 限额加载 | 写死 `[]` |

半会话语义：safety 中断 / 管线失败后允许仅 user 落库；archived 在落库前抛 `ERR_COMPANION_ARCHIVED`，**不得脏写**。

### findRecent：最新 N + 正序

```text
orderBy createdAt/id DESC → take(limit) → reverse() → 时间正序
```

禁止 `orderBy: asc, take: limit`（那是会话开头的最旧 N 条）。

### relationship 与 messageCount

- Graph Annotation 含 `messageCount`；`relationship-stage-node` 必须用 `resolveRelationshipMessageCount(state)`（优先 `state.messageCount`）。
- 仅在未注入时降级到 recent 长度；**新代码禁止**再写 `recentMessages.length` 作为主路径。

### SSE：先 persist 再 done

`CompanionChatStreamService`：有非空 reply 时 **`await persistAssistantMessage` 后再 yield `done`**。避免：

1. 客户端收到完成但历史列表尚无助手；
2. 用户连发第二轮时 `findRecent` 缺上轮助手。

`persistAssistantMessage`：content + `buildPipelineMetadataSnapshot`（quality 必含；**不含**完整 system prompt）+ messageCount+1 + `lastAssistantMessage*` 刷新。

### Quality 观测型（与 OpenSpec 一致）

`quality → summary` 边恒连；fail **不** `end_guard` 跳过 summary/memory。Safety `refuse`/`crisis_support` 仍硬中断。

### 节点 / LLM 既有约定

- **SharedNodeFactory.invokeStructured**：所有调 LLM 的节点走 `buildVariables → prompt.invoke → invokeWithFallback → fallback`。禁止裸 `llm.invoke`。
- **LLM 失败不抛错**：返回 fallback，保证管线不中断。
- **纯规则节点**：Route / Policy / QualityGuard 零 LLM。
- **Memory 关键词回退**：正则强制 `shouldExtract`，见 OpenSpec。
- **关怀 generate**：模板路径，**禁止**调完整 11 节点 Graph。

## Testing Checklist

- [ ] 每个节点单独测试（mock LLM 响应，覆盖成功与失败两条路径）
- [ ] Safety `refuse` / `crisis_support` 中断：图 END、**不**落助手、user 可已落库（设计 A）
- [ ] Quality 观测型：fail 时主回复仍落库，图继续 summary/memory
- [ ] `messageCount`：relationship 使用累计数，非 `recent.length`（`UT-REL-msg-count` / `IT-REL-message-count`）
- [ ] `findRecent`：最新 N 条正序（`IT-CTX-recent-limit`）
- [ ] 反馈注入非空 + 限额 8（`IT-FB-inject`）
- [ ] metadata 快照含 quality（`UT-MD-shape` / `IT-MD-persist`）
- [ ] archived 门闸无脏写（`IT-ST-archived-403`）；draft 可聊（`IT-ST-draft-ok`）
- [ ] 记忆 list/write/forbidden（`IT-MM-*`）；Care GET 不插库 / PATCH / generate（`IT-CA-*`）
- [ ] Memory extraction 条件跳过；纯规则节点零 LLM；`streamMode: 'updates'` 顺序

## Review Checklist

- [ ] prepareContext 是否仍「先 load 再 save user」且 archived 在落库前
- [ ] relationship 是否仍用 `messageCount` 而非 recent 窗口
- [ ] done 前是否 await 助手落库
- [ ] 新节点是否走 SharedNodeFactory；Route/Policy/Quality 是否零 LLM
- [ ] 业务行为变更是否已回写 OpenSpec companion / companion-care / companion-persona
- [ ] 关怀路径是否误接入完整 Graph

## Common Pitfalls

### messageCount vs recent 窗口

**症状**：关系阶段长期停在早期、prompt「会话消息数量」卡在 ≤18。  
**原因**：用 `recentMessages.length` 或把本轮 user 既放 `userMessage` 又放进 recent。  
**正确**：累计数来自 conversation.messageCount；recent 为落库前窗口。

### findRecent 取成最旧 N 条

**症状**：长会话 prompt 永远是开场几句。  
**原因**：`orderBy: { createdAt: 'asc' }, take: 18`。  
**正确**：desc take 再 reverse。

### 先 done 后落库

**症状**：连发第二句时上下文缺上轮助手；刷新前历史空白。  
**正确**：`await persistAssistantMessage` → `yield done`。

### 反馈写死空数组

**症状**：赞踩从不进 generate「# 8. 历史反馈」。  
**正确**：prepareContext 从 FeedbackRepository 加载，遵守 `MESSAGE_FEEDBACK_INJECTION_LIMIT`。

### Quality fail 当硬中断

**症状**：低质回复被丢弃、memory 不跑。  
**正确**：观测型——仍下发/落库 + 继续 summary/memory。

### 其它既有陷阱

- LLM 超时未设 fallback → 整条 pipeline 崩。
- Prompt 变量名与 `buildVariables` key 不一致 → 静默空串。
- 纯规则节点顺手调 LLM → 破坏 Budget。
- 热更新事件在请求时才订阅 → 配置不生效。

## Reusable Patterns

- **SharedNodeFactory 统一 LLM 调用模式** — 11 个节点共用一个工厂方法，统一错误处理、回退、日志、降级链。新增 LLM 节点直接复用。
- **纯规则引擎节点模式** — O(1) 查找表替代 LLM 分类，零成本、确定性、可测试。适用于输入维度有限、规则可枚举的决策点。
- **事件驱动配置热更新** — LlmConfigService 通过事件总线广播配置变更，节点订阅事件而非每次请求读取，避免缓存陈旧。
- **关键词回退绕过 LLM** — 正则匹配强制触发特定行为（如记忆提取），作为 LLM 判断的兜底，确保显式用户命令不被遗漏。
- **Prompt 变量链式注入** — 上游节点输出作为下游 Prompt 的上下文变量，通过 `buildVariables` 统一构建，避免散落的字符串拼接。
