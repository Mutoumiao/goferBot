# Companion Pipeline 实现方案

> AI Companion LangGraph pipeline 的 Route/Policy 规则表和提示词链模式。
>
> **REFERENCE_ONLY**: 此文件记录实现细节（HOW）。功能规范权威源为 [openspec/specs/companion/spec.md](../../../../openspec/specs/companion/spec.md)（WHAT）。Route规则/Policy Pack/LLM预算等行为应以 OpenSpec 为准。

---

## Route Rules（15 条硬编码规则）

RouteNode 是一个纯规则引擎——零 LLM 成本。它将 `(intent, emotion, relationship)` 元组与 15 条硬编码规则进行匹配，以确定对话路线、响应长度和行为标志。

**来源**: `packages/server/src/modules/companion/langgraph/nodes/route-node.ts#L27-L178`

### 规则结构

每条规则在三个维度上进行匹配：
- `intent` — 用户意图类别（例如 `emotional_support`、`casual_chat`、`question`）
- `emotion` — 检测到的用户情绪（例如 `sad`、`anxious`、`happy`、`neutral`）
- `relationship` — 当前关系阶段（例如 `trusted_companion`、`building_trust`）

输出：
- `route` — 策略名称（例如 `deep_comfort`、`light_companion`）
- `responseLength` — `short` / `medium` / `long`
- `shouldAskQuestion` — boolean
- `shouldShareExperience` — boolean
- `shouldUseNickname` — boolean
- `shouldUseMemory` — boolean

### 规则示例

```typescript
// Source: route-node.ts
{
  intent: 'emotional_support',
  emotion: 'sad',
  relationship: 'trusted_companion'
}
→ {
  route: 'deep_comfort',
  responseLength: 'medium',
  shouldAskQuestion: false,
  shouldShareExperience: true,
  shouldUseMemory: true
}
```

**核心洞察**：在原始的 `ai-partner-agent` 项目中，路由是通过 LLM 结构化输出完成的。GoferBot 将其重写为硬编码规则，以降低成本并实现确定性行为。

---

## Policy Packs（10 个策略包）

PolicyNode 是一个纯查找表——零 LLM 成本。它将 `route` 名称映射到详细的回复策略。

**来源**: `packages/server/src/modules/companion/langgraph/nodes/policy-node.ts#L30-L199`

### 策略包名称

| Route | 策略包描述 |
|-------|-----------|
| `deep_comfort` | 深度情感慰藉，共情倾听 |
| `calm_deescalation` | 焦虑缓解，正念技巧 |
| `relationship_repair` | 冲突或误解后的修复 |
| `playful_flirt` | 轻松俏皮的互动 |
| `light_companion` | 日常陪伴 |
| `quiet_presence` | 静默陪伴，不干预 |
| `practical_support` | 实用建议与问题解决 |
| `gentle_clarification` | 温和澄清用户模糊输入 |
| `memory_ack` | 确认并利用记忆 |
| `roleplay_flow` | 持续角色扮演场景 |

### 策略包结构

每个策略包定义：
- `sentenceBudget` — 响应的最大句子数
- `rhythm` — 响应节奏（例如 `pause_and_reflect`、`quick_back_and_forth`）
- `openingMove` — 如何开始响应
- `allowedMoves` — 允许的对话策略
- `forbiddenMoves` — 禁止的策略
- `questionLimit` — 每个响应的最大问题数
- `adviceLimit` — 最大建议数量
- `intimacyLevel` — `low` / `medium` / `high`
- `styleGuidance` — 语气和风格指导

---

## Prompt Injection Chain

LangChain PromptTemplates 以链式方式连接，每个节点的输出作为上下文变量注入到后续节点中。

**来源**: `packages/server/src/modules/companion/langgraph/nodes/safety-node.ts`、`intent-node.ts`、`emotion-node.ts`、`relationship-stage-node.ts`

```
safety_node (standalone)
    ↓ output: safetyResult
intent_node ← injects { safety: safetyResult }
    ↓ output: intentResult
emotion_node ← injects { safety: safetyResult, intent: intentResult }
    ↓ output: emotionResult
relationship_node ← injects {
    safety: safetyResult,
    intent: intentResult,
    emotion: emotionResult,
    messageCount,
    summary
}
```

`prompts.ts` 中有 6 个 PromptTemplates：
- `safety`
- `intent`
- `emotion`
- `relationshipStage`
- `memoryCandidate`
- `memoryExtraction`

---

## Memory Keyword Fallback

基于正则表达式的触发器强制进行记忆提取，即使基于 LLM 的记忆候选节点认为不需要提取。

**来源**: `packages/server/src/modules/companion/langgraph/nodes/memory-candidate-node.ts#L15-L16`

模式: `记住|以后|别再|我喜欢|我讨厌|我的.*是|总是`

如果用户输入匹配任何关键词，则 `shouldExtract` 被强制设为 `true`，绕过 LLM 判断。这确保了显式的记忆命令永远不会被遗漏。

---

## Shared LLM Node Factory

所有调用 LLM 的节点使用统一的工厂模式，以确保一致的错误处理。

**来源**: `packages/server/src/modules/companion/langgraph/nodes/_shared.ts#L26-L49`

```typescript
SharedNodeFactory.invokeStructured<T>(
  schema,      // Zod schema for structured output
  config,      // Prompt configuration
  fallback,    // Default value on failure
  state,       // Current CompanionState
  ctx          // NodeExecutionContext (companion profile)
) → T | fallback
```

当 LLM 失败时，返回 `fallback` 而不抛出异常，确保 pipeline 不会因 LLM 异常而停止。

### 各节点的回退值

| 节点 | 回退行为 |
|------|---------|
| safety | 默认安全结果 |
| intent | `casual_chat` |
| emotion | `neutral` |
| relationship | 保留当前阶段 |
| summary | 保留前一个摘要 |
| memoryCandidate | `shouldExtract: false` |
| memoryExtraction | 空记忆列表 |