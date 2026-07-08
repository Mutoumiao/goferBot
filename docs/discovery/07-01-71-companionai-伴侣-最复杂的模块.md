# GoferBot Discovery Report

## 7. 复杂模块

### 7.1 Companion（AI 伴侣）— 最复杂的模块

**数据来源**：[CODE\_WIKI 5.2.4](file:///d:/projects/ai-stared-project/knowledge-base/docs/CODE_WIKI.md#L419-L458)、[graph.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/companion/langgraph/graph.ts)、[interfaces.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/companion/langgraph/interfaces.ts)、Round 1 Deep Exploration

#### 来源背景

从 [ai-partner-agent](file:///d:/projects/ai-stared-project/knowledge-base/.archived/ai-partner-agent) 项目迁移而来。原项目使用 Cloudflare Workers + Hono 的顺序 Pipeline 模式，GoferBot 重写为 NestJS + LangGraph StateGraph 架构。原 9-step Pipeline 映射为 11 个 LangGraph 节点。

#### LangGraph 工作流（11 节点，7 LLM + 3 规则 + 1 条件 LLM）

```
START
  │
  ▼
┌──────────┐  refuse / crisis_support
│  safety  │ ────────────────────────► END (end_safety)
└────┬─────┘                              LLM 调用
     │ continue
     ▼
┌──────────┐
│  intent  │  LLM 调用
└────┬─────┘
     │
     ▼
┌──────────┐
│ emotion  │  LLM 调用
└────┬─────┘
     │
     ▼
┌──────────────┐
│ relationship │  LLM 调用（注入 safety+intent+emotion+messageCount+summary）
└────┬─────────┘
     │
     ▼
┌──────────┐
│  route   │  ⭐ 纯规则（15 条 ROUTE_RULES，零 LLM 成本）
└────┬─────┘
     │
     ▼
┌──────────┐
│  policy  │  ⭐ 纯规则（10 个 POLICY_PACKS 查表，零 LLM 成本）
└────┬─────┘
     │
     ▼
┌──────────┐
│ generate │  LLM 调用（8 段 Prompt 组装，temperature=0.85）
└────┬─────┘
     │
     ▼
┌──────────┐  fail
│ quality  │ ────────► END (end_guard)
└────┬─────┘          ⭐ 规则引擎（10 regex patterns，零 LLM 成本）
     │ pass/warn
     ▼
┌──────────┐
│ summary  │  LLM 调用（temperature=0.3，1600 字符上限，滚动更新）
└────┬─────┘
     │
     ▼
┌──────────────────┐  !shouldExtract
│ memory_candidate │ ─────────────────► END (skip_memory)
└────┬─────────────┘                    LLM 调用 + 关键词兜底
     │ shouldExtract                    (MEMORY_KEYWORD_REGEX)
     ▼
┌──────────────────┐
│memory_extraction │  条件 LLM 调用
└────┬─────────────┘
     │
     ▼
    END
```

**每轮对话 LLM 调用上限**: 7 次（safety + intent + emotion + relationship + generate + summary + memory_candidate + 条件 memory_extraction）。3 个节点（route / policy / quality）为纯规则引擎，零 LLM 成本。

**3 个条件分支**:
1. `safety` → boundaryAction=refuse/crisis_support 时中断管线，返回安全回复
2. `quality` → status=fail 时中断管线，丢弃不合格回复
3. `memory_candidate` → !shouldExtract 时跳过记忆提取

**Prompt 注入链**（前序输出始终作为后续 LLM 可见上下文）:
```
safety → intent(注入 safety) → emotion(注入 safety+intent) → relationship(注入 safety+intent+emotion+messageCount+summary)
```

**统一 LLM 调用模式**: 所有 LLM 节点通过 `SharedNodeFactory.invokeStructured<T>(schema, config, fallback, state, ctx)` 统一调用，失败自动返回 fallback 值保证管线不中断。

- **记忆系统**：5 种记忆类型 (preference/boundary/relationship\_goal/conversation\_style/important\_fact)，按 importance 排序注入上下文。记忆提取含关键词兜底（MEMORY_KEYWORD_REGEX 匹配"记住/以后/别再/我喜欢"→ 强制 shouldExtract=true）
- **关怀计划**：定时主动关怀（daily/weekly/monthly/custom），场景化消息生成
- **Prisma 模型**：10 个表（Companion / Conversation / Message / Memory / Feedback / CarePlan / CareEvent / GroupChat / GroupChatMember / GroupChatMessage）
- **共享 Schema**：companion-pipeline.schema.ts 定义了 LangGraph 管线的 intent/emotion/safety/quality/memory/summary 等 Zod 校验
