# GoferBot Discovery Report

## 7. 复杂模块

### 7.10 Companion LangChain 层 — LLM 适配基础设施

**数据来源**：[langchain-llm.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/companion/langchain/langchain-llm.service.ts)、[structured-output.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/companion/langchain/structured-output.service.ts)、[llm-config.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/companion/config/llm-config.service.ts)、[shared.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/companion/langgraph/nodes/_shared.ts)

#### LangChain vs LlamaIndex 明确分工

| 模块 | LLM 适配层 | 说明 |
|------|-----------|------|
| **Companion** | `ProviderRegistry → toLangChain()` | LangChain ChatOpenAI/ChatOllama，需要 `withStructuredOutput()` 多方法降级链 |
| **Chat** | `ProviderRegistry → toLlamaIndex()` | LlamaIndex OpenAI/Ollama，仅需 streaming |
| **RAG (LLM)** | `ProviderRegistry → toLlamaIndex()` | LlamaIndex OpenAI/Ollama，生成侧上下文构建 |
| **RAG (Embedding)** | 直接 `new OpenAIEmbedding()` | Embedding 生成（暂未纳入 ProviderRegistry） |

> **v22 统一**：Chat/RAG/Companion 三端 LLM 客户端创建均通过 `ProviderRegistry.get(id, model)` 获取，不再各自构造 SDK 对象。详见 §7.10b Provider 架构。

#### StructuredOutput — 三方法降级链

`StructuredOutputService.invokeWithFallback<T>()` 实现 3 种结构化输出方法的自动降级：

| API 类型 | 方法优先级 | 说明 |
|----------|-----------|------|
| `chat_completions` | functionCalling → jsonSchema → jsonMode | OpenAI 标准 API |
| `responses` | jsonSchema → functionCalling → jsonMode | OpenAI Responses API |

- 每个方法: `model.withStructuredOutput(schema, {name, method})` → `invoke(prompt)`
- 结果经 `schema.parse()` **二次 Zod 校验**
- **temperature=0**（结构化输出必须确定性）
- 全失败抛 `InternalServerErrorException`

#### LlmConfigService — 热更新配置链（v22 迁移至 ProviderRegistry）

```
SystemConfigService.getDecryptedSystemConfig()
  → settings.companion.provider (provider ID#{modelName})
  → ModelProviderService.resolveProvider("companion.provider", "llm")
  → { providerId, modelName }
  → ProviderRegistry.get(providerId, modelName)  ← v22 统一入口（替代直接 new ChatOpenAI）
    → lazy create + cache → provider.toLangChain()
```

- 监听 `@OnEvent('config.changed')` 事件热更新
- 仅监听 `companion` 和 `providers` 分类变更
- 未配置时抛 `MODEL_PROVIDER_ERROR_CODES.NOT_CONFIGURED`

#### 完整 LLM 调用层级（v22）

```
LangGraph Node (e.g. intent-node)
  → SharedNodeFactory.invokeStructured<T>(schema, config, fallback, state, ctx)
    → buildVariables(state, ctx) → prompt.invoke(variables)
    → StructuredOutputService.invokeWithFallback({schema, name}, prompt, signal)
      → LlmConfigService.createLangChainChatModel({temperature: 0})
        → ProviderRegistry.get(providerId, modelName)  ← v22 统一入口
          → cache hit: 直接返回; cache miss: SystemConfigService + PROVIDER_REGISTRY 新建
        → provider.toLangChain()
      → model.withStructuredOutput(schema, {name, method}).invoke(prompt)
      → schema.parse(result)  // Zod 二次验证
  → 成功: 返回 T
  → 失败: 返回 fallback (保证 LangGraph 管线不中断)
```
