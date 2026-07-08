> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为
> [openspec/specs/settings/spec.md](../../../openspec/specs/settings/spec.md)（WHAT）。
> 所有业务规则、API 契约、错误码、状态机定义以 OpenSpec 为准。

# Provider 模块开发指南

## 1. Purpose

本指南描述 Provider 类体系的开发模式、实现要点、测试验证清单和常见陷阱。适用于：
- 新增 Provider 子类支持新的 LLM 协议
- 修改现有 Provider 的 fetchModels/toLlamaIndex/toLangChain 逻辑
- 调试 ProviderRegistry 缓存问题
- 扩展 Provider 配置字段

## 2. Primary OpenSpec

- [openspec/specs/settings/spec.md](../../../openspec/specs/settings/spec.md) — 系统设置业务规范，包含 Provider 类体系架构定义

## 3. Related OpenSpec

- [openspec/specs/chat/spec.md](../../../openspec/specs/chat/spec.md) — Chat SSE 流式聊天契约，消费 Provider 客户端
- [openspec/specs/rag/spec.md](../../../openspec/specs/rag/spec.md) — RAG 管线，消费 Provider 客户端
- [openspec/specs/companion/spec.md](../../../openspec/specs/companion/spec.md) — Companion 工作流，消费 Provider 客户端

## 4. Related Trellis Guides

- [错误处理](./error-handling.md) — AppException 错误体系
- [质量指南](./quality-guidelines.md) — ResponseInterceptor 信封规范、共享 Schema 约定

## 5. When You Need To

阅读本指南当：
- 需要添加新的 LLM Provider 支持（如 Claude、Gemini）
- 需要修改 Provider 的协议适配逻辑
- 需要调试模型获取或 LLM 调用问题
- 需要修改 ProviderRegistry 缓存策略

## 6. Module Dependencies

| 依赖 | 说明 |
|------|------|
| `@nestjs/common` | NestJS 核心模块 |
| `@nestjs/event-emitter` | 配置变更事件监听 |
| `@llamaindex/openai` | LlamaIndex OpenAI 协议客户端 |
| `@llamaindex/ollama` | LlamaIndex Ollama 客户端 |
| `@langchain/openai` | LangChain OpenAI 协议客户端 |
| `@langchain/ollama` | LangChain Ollama 客户端 |
| `@goferbot/data` | 共享类型定义（FetchedModel、ProviderType） |

## 7. Implementation Notes

### 7.1 类体系架构

```
BaseProvider (基类，OpenAI 协议默认实现)
  ├── DeepSeekProvider (复用基类默认实现)
  ├── OllamaProvider (自定义 /api/tags 协议)
  └── CustomProvider (不支持 fetchModels)
```

### 7.2 新增 Provider 子类步骤

1. 在 `providers/` 目录创建新文件（如 `claude.provider.ts`）
2. 继承 `BaseProvider`，覆盖需要自定义的方法：
   - `fetchModels()` — 远程模型列表获取（默认使用 OpenAI /models）
   - `toLlamaIndex()` — 返回 LlamaIndex 客户端
   - `toLangChain()` — 返回 LangChain 客户端
3. 在 `PROVIDER_REGISTRY` 中注册新类
4. 在 `presets/providers.json` 中添加预设配置
5. 编写单元测试

### 7.3 ProviderConfig 接口

```typescript
interface ProviderConfig {
  id: string              // Provider ID
  name: string            // 显示名称
  enabled: boolean        // 是否启用
  apiKey: string          // API 密钥
  baseUrl: string         // 基础 URL
  isCompleteUrl: boolean  // 是否完整 URL
  timeoutMs: number       // 超时时间
  model: string           // 模型名（Model 级）
  type: ProviderType      // 模型类型（llm/embedding/reranker/document-parser）
  dimensions?: number     // Embedding 维度
  maxLength?: number      // 最大长度
}
```

### 7.4 ProviderRegistry 调用模式

```typescript
// 懒加载获取（带缓存）
const provider = await providerRegistry.get(providerId, modelName)

// 创建临时实例（不缓存，供 fetchModels 端点使用）
const provider = providerRegistry.createFromPreset(presetKey, baseUrl, apiKey)

// 清除指定 Provider 缓存
providerRegistry.invalidate(providerId)

// 清除全部缓存
providerRegistry.invalidateAll()
```

### 7.5 fetchModels 实现规范

- 必须设置 15 秒超时（`AbortSignal.timeout(15_000)`）
- 必须限制响应体大小（最大 1MB），防止 OOM
- 必须检查 `Content-Length` 头和实际 `text.length`
- 返回类型必须符合 `FetchedModel[]`（在 `@goferbot/data` 中定义）

### 7.6 toLlamaIndex 返回值标记

`BaseProvider.toLlamaIndex()` 返回的客户端会被标记 `_providerReady: true`，供 `LlamaIndexProvider.isClient()` 识别：

```typescript
return Object.assign(client, { _providerReady: true })
```

### 7.7 错误工厂函数

使用 `errors.ts` 中定义的工厂函数，禁止直接 `throw new Error()`：

```typescript
// ✅ 正确
throw fetchModelsNotSupportedError()
throw unknownPresetError(presetKey)
throw modelNotEnabledError(providerId, modelName)

// ❌ 错误
throw new Error('不支持获取模型')
```

## 8. Testing Checklist

| 测试项 | 说明 |
|--------|------|
| ProviderRegistry.get() | 验证懒加载和缓存机制 |
| ProviderRegistry.invalidate() | 验证缓存失效 |
| ProviderRegistry.createFromPreset() | 验证预设创建和未知预设错误 |
| BaseProvider.fetchModels() | 验证 OpenAI 协议模型获取 |
| OllamaProvider.fetchModels() | 验证 Ollama /api/tags 协议 |
| CustomProvider.fetchModels() | 验证抛出 FETCH_MODELS_NOT_SUPPORTED |
| toLlamaIndex() | 验证返回客户端类型和配置 |
| toLangChain() | 验证返回客户端类型和配置 |
| fetchModels 超时 | 验证 15 秒超时处理 |
| fetchModels 响应大小限制 | 验证 1MB 限制 |

## 9. Review Checklist

- [ ] Provider 子类覆盖的方法符合协议规范
- [ ] `fetchModels()` 设置了超时和响应大小限制
- [ ] `toLlamaIndex()` 返回值标记了 `_providerReady: true`
- [ ] 错误使用 `errors.ts` 工厂函数
- [ ] 在 `PROVIDER_REGISTRY` 中注册了新类
- [ ] 添加了对应的预设配置
- [ ] 编写了单元测试

## 10. Common Pitfalls

### 10.1 忘记注册 Provider 类

**问题**：新增 Provider 子类后未在 `PROVIDER_REGISTRY` 中注册，导致 `createFromPreset()` 抛出 `UNKNOWN_PRESET`。

**修复**：在 `providers/index.ts` 的 `PROVIDER_REGISTRY` 对象中添加新类。

### 10.2 fetchModels 未设置响应大小限制

**问题**：远程 API 返回超大 JSON 导致内存溢出。

**修复**：添加 `MAX_RESPONSE_SIZE = 1_000_000` 检查，同时验证 `Content-Length` 和 `text.length`。

### 10.3 toLlamaIndex 未标记 _providerReady

**问题**：`LlamaIndexProvider.isClient()` 无法识别客户端，导致测试失败。

**修复**：返回时使用 `Object.assign(client, { _providerReady: true })`。

### 10.4 Controller 自行包装响应信封

**问题**：`fetchModels` 端点返回 `{ success, models }`，导致 ResponseInterceptor 包装后出现双层 `success`。

**修复**：Controller 返回纯业务数据 `{ models: [...] }`，由 ResponseInterceptor 自动包装。

## 11. Reusable Patterns

### 11.1 协议适配器模式

每个 Provider 子类适配一种 LLM 协议，通过覆盖基类方法实现差异化：

```typescript
export class CustomProvider extends BaseProvider {
  async fetchModels(): Promise<FetchedModel[]> {
    // 自定义协议实现
  }
  
  toLlamaIndex(): any {
    return new CustomClient({ ... })
  }
}
```

### 11.2 缓存失效模式

`ProviderRegistry` 监听 `config.changed` 事件，当 `category === 'providers'` 时自动清除缓存：

```typescript
this.eventEmitter.on('config.changed', (event) => {
  if (event.category === 'providers') {
    this.invalidateAll()
  }
})
```

### 11.3 共享 Schema 模式

`FetchedModel` 和 `ProviderPreset` 在 `@goferbot/data` 中定义 Zod Schema，server 和 admin 前端通过 `z.infer` 派生类型，禁止各自定义 interface。
