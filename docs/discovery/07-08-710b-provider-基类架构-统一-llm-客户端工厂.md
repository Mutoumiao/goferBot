# GoferBot Discovery Report

## 7. 复杂模块

### 7.10b Provider 基类架构 — 统一 LLM 客户端工厂

**数据来源**：[base.provider.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/settings/providers/base.provider.ts)、[ollama.provider.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/settings/providers/ollama.provider.ts)、[custom.provider.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/settings/providers/custom.provider.ts)、[providers/index.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/settings/providers/index.ts)

> **v22 新增**：将分散在 Chat（`@llamaindex/openai`）、RAG（`@llamaindex/openai`）、Companion（`@langchain/openai`）三处的 LLM 客户端创建逻辑统一到 Provider 配置层，通过 `ProviderRegistry` 提供懒加载缓存、全局复用、热更新清除机制。

#### 架构概览

```
                  ┌──────────────────────────────────────┐
                  │         ProviderRegistry              │
                  │  (NestJS @Injectable Singleton)       │
                  │                                      │
                  │  cache: Map<key, BaseProvider>         │
                  │  get(id, model) → BaseProvider         │
                  │  invalidate(providerId)               │
                  │  @OnEvent('config.changed')           │
                  └──────┬───────────────────────────────┘
                         │ creates & caches
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
 ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
 │ BaseProvider  │ │OllamaProvider│ │CustomProvider│
 │ (OpenAI协议)  │ │ (非OpenAI)   │ │ (OpenAI,无  │
 │              │ │              │ │ fetchModels) │
 └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
        │                │                │
        └────────────────┼────────────────┘
                         │ extends
                  ┌──────┴───────┐
                  │ BaseProvider  │ (abstract)
                  │               │
                  │ toLlamaIndex()│ → LlamaIndex SDK 客户端（Chat/RAG 消费）
                  │ toLangChain() │ → LangChain SDK 客户端（Companion 消费）
                  │ fetchModels() │ → FetchedModel[]（内置供应商覆盖）
                  └───────────────┘
```

#### Provider 类体系

| Provider | 协议 | SDK 依赖 | fetchModels | 说明 |
|----------|------|---------|-------------|------|
| **BaseProvider** | OpenAI 兼容 | `@llamaindex/openai` + `@langchain/openai` | GET `{baseURL}/models` → `{data: [{id}]}` | 默认实现，DeepSeek/OpenAI 等直接使用 |
| **OllamaProvider** | Ollama 原生 | `@llamaindex/ollama` + `@langchain/ollama` | GET `{baseURL}/api/tags` → `{models: [{name, details}]}` | 覆盖全部三个方法 |
| **CustomProvider** | OpenAI 兼容 | 同 BaseProvider | `throw fetchModelsNotSupportedError()` | 自建代理/反向代理 |

**PROVIDER_REGISTRY 注册表**：`{ deepseek: BaseProvider, ollama: OllamaProvider, custom: CustomProvider }`。未来的 OpenAI 等可复用 BaseProvider。

#### ProviderRegistry 缓存层

- **懒加载**: 首次请求 `{providerId}#{modelName}` 时读取配置、创建 Provider 实例、缓存
- **全局复用**: Chat 多会话、RAG、Companion 共享同一缓存实例
- **热更新**: 监听 `config.changed` 事件 → `invalidateAll()` 清除全部缓存，下次请求懒重建
- **并发安全**: Node.js 单线程 Map 操作安全；并发 cache miss 时可能重复创建（先到先存，无数据错误）

#### 消费端统一化

```
Before (v21):
  ChatService → LlmProviderFactory → new OpenAI(...)
  RAG LLM    → LlamaIndexProvider → new OpenAI(...)
  Companion  → LlmConfigService → new ChatOpenAI(...)

After (v22):
  ChatService → ProviderRegistry.get(id, model).toLlamaIndex()
  RAG LLM    → ProviderRegistry.get(id, model).toLlamaIndex()
  Companion  → ProviderRegistry.get(id, model).toLangChain()
```

**删除**：`LlmProviderFactory`、`LlamaIndexProvider` 包装类（已死代码）。

#### 关键设计

1. **BaseProvider 是抽象类**：`toLlamaIndex()`/`toLangChain()` 有默认 OpenAI 协议实现，子类不需要覆盖
2. **fetchModels() 是 abstract**：强制每个子类显式决定是否支持，CustomProvider 抛 `FETCH_MODELS_NOT_SUPPORTED`
3. **isCompleteUrl 支持**：配置 Base URL 时可选"完整 URL"模式（strip `/chat/completions` 等后缀）
4. **presetKey 路由**：`POST /admin/providers/fetch-models` 前端传 `presetKey`，服务端按 key 创建对应 Provider 类
5. **前端 `hasFetchModels`**：`GET /admin/providers/presets` 返回每预设是否支持一键获取模型列表，前端据此条件渲染按钮

***
