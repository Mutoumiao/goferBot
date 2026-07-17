# Settings - 系统设置

## Purpose（目的）

定义 GoferBot 系统配置管理规范，包括配置分层架构、模型提供商管理、用户偏好设置、系统级参数管理、配置加密与安全。

## Architecture（架构）

### 配置分层架构

系统采用三层配置合并策略，优先级从低到高：

```
DEFAULT_CONFIG (内置默认值)
      ↓ 合并
SYSTEM_CONFIG (管理员配置)
      ↓ 合并
APP_CONFIG (用户个人配置)
```

**合并规则**：
- Provider 池以系统配置为准，用户自定义仅作为补充
- 用户配置仅允许修改 `appearance` 分类，其他分类为只读
- 深层合并：对象类型递归合并，数组和基本类型直接覆盖

**配置存储**：
- 存储在 `Setting` 表，按 `userId_key` 唯一标识
- 系统配置使用 `SYSTEM_USER_ID` (`00000000-0000-0000-0000-000000000000`)
- 用户配置使用用户实际 ID

### 模块职责划分

| 模块                   | 职责                                      | 关键文件                                                                                                                                         |
|------------------------|-------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| `SettingsService`      | 用户配置 CRUD、配置合并、遗留迁移         | [settings.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/settings/settings.service.ts)             |
| `SystemConfigService`  | 系统配置 CRUD、Provider 池管理、事件通知  | [system-config.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/settings/system-config.service.ts)   |
| `ModelProviderService` | Provider 引用验证、模型级解析、旧格式迁移 | [model-provider.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/settings/model-provider.service.ts) |
| `ConfigCryptoService`  | API Key 加密/解密/掩码                    | [config-crypto.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/settings/config-crypto.service.ts)   |
| `ProviderRegistry`     | Provider 类实例缓存、懒加载、配置变更失效 | [providers/index.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/settings/providers/index.ts)               |

### Provider 类体系架构

系统采用类继承体系实现多 Provider 协议支持，消费端通过 `ProviderRegistry` 获取实例。

```
BaseProvider (抽象基类)
  ├── fetchModels()         → OpenAI /models 协议
  ├── toLlamaIndex()        → 返回 LlamaIndex 客户端
  ├── toLangChain()         → 返回 LangChain 客户端
  └── inferModelType()      → 根据模型名推断类型

DeepSeekProvider (OpenAI 协议)
  └── fetchModels()         → 复用 BaseProvider.defaultFetchModels()

OllamaProvider (自定义协议)
  ├── fetchModels()         → /api/tags 协议
  ├── toLlamaIndex()        → 返回 Ollama 客户端
  └── toLangChain()         → 返回 ChatOllama 客户端

CustomProvider (无远程模型)
  └── fetchModels()         → 抛出 FETCH_MODELS_NOT_SUPPORTED
```

#### ProviderRegistry 缓存机制

`ProviderRegistry` 是 NestJS 单例服务，管理 Provider 实例的生命周期：

| 特性 | 说明 |
|------|------|
| 缓存键 | `{providerId}#{modelName}` |
| 缓存策略 | 懒加载，首次获取时创建并缓存 |
| 失效机制 | `config.changed` 事件触发时清除全部缓存 |
| 预设创建 | `createFromPreset()` 创建临时实例（不缓存），供 fetchModels 端点使用 |

#### 消费端调用模式

```typescript
// ChatService / Companion / Knowledge AI 注入
const provider = await providerRegistry.get(providerId, modelName)
const llamaIndexClient = provider.toLlamaIndex()      // Chat 标题等本地 LLM 用途
// 知识检索/生成：解密 settings 后由 KnowledgeAiProviderResolver 组装 _provider 注入 Python
const langChainClient = provider.toLangChain()        // Companion
const models = await provider.fetchModels()           // 配置页面
```

### 配置分类

| 分类         | 说明                                    | 用户可修改 | 默认值                                                                      |
|--------------|-----------------------------------------|------------|-----------------------------------------------------------------------------|
| `providers`  | 模型提供商池（LLM/Embedding/Reranker）  | 否         | `{}`                                                                        |
| `chat`       | 聊天配置（默认提供商、启用列表、温度）  | 否         | `{ enabledProviders: [], temperature: 0.7 }`                                |
| `rag`        | 知识问答/索引配置（Embedding/Rerank/retrievalMode） | 否 | `{ retrievalMode: 'strict', timeoutMs: 60000, embeddingProvider?, rerankerProvider? }` |
| `companion`  | 伴侣配置（LLM 提供商 + 全局安全/上限）  | 否         | `{ maxUserCompanions: 10 }`（安全字段默认可空）                             |
| `indexing`   | 索引配置（上下文嵌入、Chunk 大小）      | 否         | `{ contextualEmbedding: false, parentChunkSize: 800, childChunkSize: 150 }` |
| `appearance` | 外观配置（主题、字号）                  | 是         | `{ mode: 'light', fontSizeLevel: 3 }`                                       |

## Requirements（需求）

### Requirement: 配置分层与合并

系统应支持系统级配置与用户级配置的分层管理，用户配置覆盖系统配置，但 Provider 池以系统配置为准。

证据来源：
- [settings.service.ts#L403-L428](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/settings/settings.service.ts#L403-L428)

#### Scenario: 获取合并后的用户配置
- **WHEN** 用户请求获取配置时
- **THEN** 系统依次合并 DEFAULT_CONFIG → SYSTEM_CONFIG → APP_CONFIG，返回合并结果

#### Scenario: Provider 池优先级
- **WHEN** 用户配置中包含自定义 Provider
- **THEN** 系统合并时以系统配置的 Provider 池为主，用户自定义作为补充

### Requirement: 模型提供商配置

系统应支持配置多个模型提供商，每个提供商可包含多种类型的模型（LLM/Embedding/Reranker/Document-Parser）。API key、基础 URL 和模型选择需安全存储。

证据来源：
- [model-provider.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/settings/model-provider.service.ts)
- [system-config.controller.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/settings/system-config.controller.ts)
- [settings.schema.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/data/src/schemas/settings.schema.ts)

#### Scenario: 添加模型提供商
- **WHEN** 管理员配置新的模型提供商（如 DeepSeek、Ollama）
- **THEN** 系统加密存储 API key，后端自动生成唯一 ID（`{slug}-{random4}`），并使该提供商可用于配置引用

#### Scenario: 一个提供商包含多种类型模型
- **WHEN** 管理员为同一 Provider 添加多个不同类型的 Model（如 Ollama 同时有 LLM 和 Embedding 模型）
- **THEN** 系统将所有模型存储在 `provider.models` 数组中，每个模型独立标注 `type`

#### Scenario: API key 安全
- **WHEN** API key 被存储或检索时
- **THEN** 系统应在静态存储时加密密钥，且绝不在 API 响应中返回完整密钥（仅显示掩码形式）

#### Scenario: 模型类型校验
- **WHEN** 引用配置（如 `chat.defaultProvider`、`rag.embeddingProvider`）被解析时
- **THEN** 系统通过 `ModelProviderService.resolveProvider()` 解析 `{providerId}#{modelName}` key，在 `provider.models` 中查找匹配类型且 enabled 的模型，返回 `ResolvedProvider` 扁平化视图

#### Scenario: dto.model 覆盖校验
- **WHEN** 聊天请求通过 `dto.model` 传入与默认配置不同的模型名时
- **THEN** 系统验证该模型存在于对应 Provider 的 `models` 数组中，且类型为 `llm` 且 `enabled=true`
- **AND** 验证不通过时返回 `MODEL_PROVIDER_TYPE_MISMATCH` 错误，防止用户绕过配置指定未授权的模型

#### Scenario: 完整 URL 模式
- **WHEN** Provider 的 `isCompleteUrl = true` 时
- **THEN** SDK 直接使用 `baseUrl` 作为完整请求路径，不拼接 `/chat/completions` 或 `/embeddings` 等默认后缀

#### Scenario: 删除 Provider 引用检查
- **WHEN** 管理员尝试删除 Provider 时
- **THEN** 系统通过 `collectProviderReferences()` 检查该 Provider 是否被任何配置引用（系统或用户），引用 key 可以是 `{providerId}` 或 `{providerId}#{modelName}`，如有引用则拒绝删除

### Requirement: 预设提供商与远程模型获取

系统应提供预设提供商模板供前端选择，并支持代理调用远程 API 获取可用模型列表。

证据来源：
- [system-config.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/settings/system-config.service.ts) — `getPresets()`、`fetchModels()`
- [presets/providers.json](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/settings/presets/providers.json)

#### Scenario: 获取预设提供商列表
- **WHEN** 前端请求 `GET /admin/providers/presets` 时
- **THEN** 系统返回静态 JSON 配置中的预设列表（13 个预设，含 DeepSeek、Qwen、Ollama、OpenAI 等），每个预设包含 `key`、`label`、`name`、`baseUrl`

#### Scenario: 代理获取远程模型列表
- **WHEN** 前端请求 `POST /admin/providers/fetch-models`（传入 `baseUrl`、`apiKey`、`isCompleteUrl`）
- **THEN** 系统代理调用远程 `/models` 端点，解析后返回 `{ models: FetchedModel[] }` 纯业务数据
- **AND** ResponseInterceptor 自动包装为 `{ success: true, data: { models: [...] }, meta: { requestId, timestamp } }`
- **AND** `FetchedModel` 类型 MUST 在 `@goferbot/data` 中定义为 Zod Schema（`fetchedModelSchema`），server 和 admin 前端通过 `z.infer<typeof fetchedModelSchema>` 派生类型，禁止各自定义 interface

#### Scenario: fetch-models SSRF 防护
- **WHEN** `POST /admin/providers/fetch-models` 的 `baseUrl` 指向内网地址（如 `169.254.169.254`、`127.0.0.1`、`localhost` 生产环境）
- **THEN** 系统返回 400 错误，提示 baseUrl 不合法或指向受限内网地址
- **AND** 生产环境不允许 localhost/127.0.0.1，开发环境放行 localhost

#### Scenario: fetch-models 响应大小限制
- **WHEN** 远程 `/models` 端点返回超过 1MB 的响应体
- **THEN** 系统拒绝解析并返回错误，防止内存溢出（OOM）
- **AND** 系统同时检查 `Content-Length` 头和实际响应体大小

### Requirement: 用户偏好设置

系统应允许用户配置个人偏好设置，包括默认 LLM 提供商、模型、语言和 UI 主题。

证据来源：
- [settings.controller.ts#L77-L96](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/settings/settings.controller.ts#L77-L96)

#### Scenario: 设置默认聊天模型
- **WHEN** 用户为新的聊天会话选择偏好的 LLM 模型时
- **THEN** 系统持久化该偏好设置，并将其应用于所有新会话

#### Scenario: 主题偏好
- **WHEN** 用户在浅色和深色主题之间切换时
- **THEN** 系统持久化该偏好设置并立即应用

#### Scenario: 用户端只读限制
- **WHEN** 用户尝试修改非 appearance 分类的配置时
- **THEN** 系统返回错误，提示通过管理后台配置

### Requirement: 系统配置

系统应支持管理员管理的系统级配置，包括速率限制、文件大小限制和功能开关。

证据来源：
- [system-config.controller.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/settings/system-config.controller.ts)

#### Scenario: 配置速率限制
- **WHEN** 管理员为 API 端点设置速率限制时
- **THEN** 系统对每个用户/IP 强制执行该限制，并返回相应的 HTTP 429 响应

#### Scenario: 功能开关切换
- **WHEN** 管理员启用或禁用某个功能（如 RAG 检索、特定 LLM 提供商）时
- **THEN** 系统立即在 UI 和 API 行为中反映该变更

#### Scenario: 配置变更事件
- **WHEN** 系统配置变更时
- **THEN** 系统触发 `config.changed` 事件，通知订阅模块重新加载配置

### Requirement: 配置加密与安全

系统应使用 AES-256-GCM 加密敏感配置（API Key），并在返回时进行掩码处理。

证据来源：
- [config-crypto.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/settings/config-crypto.service.ts)

#### Scenario: API Key 加密存储
- **WHEN** 配置被持久化时
- **THEN** 系统递归加密所有 `apiKey` 字段，使用 AES-256-GCM 算法

#### Scenario: API Key 掩码返回
- **WHEN** 配置被读取并返回给客户端时
- **THEN** 系统将 `apiKey` 替换为 `MASKED:xxx` 格式，保护密钥安全

#### Scenario: 加密密钥验证
- **WHEN** 服务启动时
- **THEN** 系统验证 `SETTINGS_ENCRYPTION_KEY` 环境变量是否存在，缺失则快速失败

### Requirement: 遗留配置迁移

系统应自动迁移旧版配置格式到新版分层结构。

证据来源：
- [settings.service.ts#L36-L242](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/modules/settings/settings.service.ts#L36-L242)

#### Scenario: 扁平配置迁移
- **WHEN** 系统读取到旧版扁平格式配置时
- **THEN** 系统自动迁移到新版分层结构，并异步保存迁移结果

#### Scenario: 嵌套配置迁移
- **WHEN** 系统读取到旧版嵌套格式配置（包含 llm/rag/embedding 直接字段）时
- **THEN** 系统提取 Provider 信息到 providers 池，并更新引用关系

### Requirement: 环境变量管理

系统应遵循分层环境变量加载策略：包级别的 `.env` 覆盖根级别的 `.env`。

证据来源：
- `.env.example` (root level)
- `packages/server/.env.example`
- `packages/web/.env.example`

#### Scenario: 服务端环境加载
- **WHEN** 服务端启动时
- **THEN** 它先加载 `packages/server/.env`，然后加载根目录 `.env`，后加载的值覆盖先前的值

#### Scenario: 必需变量验证
- **WHEN** 启动时缺少必需的环境变量或变量无效时
- **THEN** 系统应快速失败，并显示描述性错误消息，列出所有缺失的变量

## API Endpoints（API 端点）

### Response Envelope 统一格式

所有 Admin API 端点（非 SSE 流式端点）的响应由 `ResponseInterceptor` **自动包装**为以下统一信封，Controller 无需手动处理：

```typescript
{
  success: true,         // 框架统一注入（Controller 无需关心）
  data: T,               // ← Controller 的返回值自动填入此处
  meta: {
    requestId: string,   // 请求追踪 ID
    timestamp: string,   // 响应时间（ISO 8601）
  }
}
```

**Controller 的职责**：只返回纯业务数据（填入 `data` 的内容），不返回传输层字段（`success`/`error`/`code`/`message`）。

```typescript
// ✅ Controller 返回纯业务数据 → 自动填入 data
// 实际响应：{ success: true, data: { models: [...] }, meta: {...} }
async fetchModels(@Body() dto: FetchModelsDto): Promise<{ models: FetchedModel[] }> {
  return this.service.fetchModels(dto)
}

// ❌ Controller 返回含 success/error 的对象 → data 里多出一层冗余壳
// 实际响应：{ success: true, data: { success: true, models: [...] }, meta: {...} }
async fetchModels(@Body() dto: FetchModelsDto): Promise<FetchModelsResult> {
  return this.service.fetchModels(dto)  // FetchModelsResult = { success, models, error? }
}
```

**跨层 Schema 共享**：
- 所有跨层消费的请求/响应类型 MUST 在 `@goferbot/data` 中定义为 Zod Schema，server 和 admin 前端各自通过 `z.infer` 派生 TS 类型
- Server DTO MUST 从 `@goferbot/data` 导入 Schema，使用 `createZodDto(schema)` 模式，禁止本地重复定义

### 用户配置端点

| 方法 | 路径                            | 说明                                      | 权限 |
|------|---------------------------------|-------------------------------------------|------|
| GET  | `/settings`                     | 获取用户配置（已掩码）                    | JWT  |
| GET  | `/settings/:category`           | 获取指定分类配置                          | JWT  |
| GET  | `/settings/:category/providers` | 获取可用模型列表（仅 chat/rag/companion） | JWT  |
| POST | `/settings`                     | 保存用户配置（仅 appearance）             | JWT  |
| POST | `/settings/:category`           | 保存分类配置（仅 appearance）             | JWT  |

### 系统配置端点（管理员）

| 方法 | 路径                             | 说明                   | 权限                    |
|------|----------------------------------|------------------------|-------------------------|
| GET  | `/admin/system-config`           | 获取系统配置（已掩码） | `moduleSettings:read`   |
| GET  | `/admin/system-config/:category` | 获取系统配置分类       | `moduleSettings:read`   |
| POST | `/admin/system-config/:category` | 保存系统配置分类       | `moduleSettings:update` |
| POST | `/admin/system-config/reload`    | 触发配置重载           | `moduleSettings:update` |

### Provider 池端点（管理员）

| 方法   | 路径                            | 说明                                          | 权限                    |
|--------|---------------------------------|-----------------------------------------------|-------------------------|
| GET    | `/admin/providers`              | 获取所有 Provider（已掩码）                   | `modelProviders:read`   |
| GET    | `/admin/providers/presets`      | 获取预设提供商列表                            | `modelProviders:read`   |
| GET    | `/admin/providers/:id`          | 获取指定 Provider（已掩码）                   | `modelProviders:read`   |
| POST   | `/admin/providers`              | 保存 Provider（新建时 id 留空，后端自动生成） | `modelProviders:create` |
| POST   | `/admin/providers/fetch-models` | 代理获取远程模型列表                          | `modelProviders:create` |
| DELETE | `/admin/providers/:id`          | 删除 Provider                                 | `modelProviders:delete` |

## Data Models（数据模型）

### ModelProvider

| 字段          | 类型    | 必填 | 说明                                                                       |
|---------------|---------|------|----------------------------------------------------------------------------|
| id            | string  | 是   | Provider 唯一标识（新建时留空，后端根据 name 自动生成 `{slug}-{random4}`） |
| name          | string  | 是   | 显示名称                                                                   |
| notes         | string  | 否   | 备注                                                                       |
| enabled       | boolean | 否   | 是否启用（默认 true）                                                      |
| apiKey        | string  | 是   | API 密钥（存储时加密，返回时掩码）                                         |
| baseUrl       | string  | 否   | 自定义基础 URL（默认空）                                                   |
| isCompleteUrl | boolean | 否   | 是否完整 URL（默认 false；true 时 SDK 不拼接默认路径）                     |
| timeoutMs     | number  | 否   | 超时时间（默认 300000）                                                    |
| models        | Model[] | 否   | 模型列表（一个 Provider 可包含多种类型的模型，默认 `[]`）                  |

### Model

| 字段       | 类型                                              | 必填 | 说明                                                           |
|------------|---------------------------------------------------|------|----------------------------------------------------------------|
| name       | string                                            | 是   | 模型名（如 `deepseek-chat`）                                   |
| type       | 'llm'\|'embedding'\|'reranker'\|'document-parser' | 是   | 模型类型                                                       |
| enabled    | boolean                                           | 否   | 是否启用（默认 true）                                          |
| dimensions | number                                            | 否   | Embedding 维度（仅 embedding 类型，远程 API 模型通常自动获取） |
| maxLength  | number                                            | 否   | 最大输入长度（仅 reranker 类型）                               |

> **模型唯一标识**：消费端使用 `{providerId}#{modelName}` 格式（如 `deepseek#deepseek-chat`）引用具体模型。`ModelProviderService.parseModelKey()` / `buildModelKey()` 提供解析与构造。

### Settings

| 字段       | 类型                          | 默认值 | 说明                                               |
|------------|-------------------------------|--------|----------------------------------------------------|
| version    | number                        | 2      | 配置格式版本（v1: 单 model 字段; v2: models 数组） |
| providers  | Record<string, ModelProvider> | `{}`   | 模型提供商池                                       |
| chat       | ChatSettings                  | 见下方 | 聊天配置                                           |
| rag        | RagSettings                   | 见下方 | RAG 配置                                           |
| companion  | CompanionSettings             | 见下方 | 伴侣配置（LLM + 全局安全/上限）                    |
| indexing   | IndexingSettings              | 见下方 | 索引配置                                           |
| appearance | AppearanceSettings            | 见下方 | 外观配置                                           |

### CompanionSettings

| 字段                      | 类型   | 默认值    | 说明 |
|---------------------------|--------|-----------|------|
| provider                  | string | undefined | Companion LLM 提供商/模型引用 |
| defaultBoundaries         | string | 空        | 自定义伴侣全局行为边界文案 |
| defaultGuardrailsPrompt   | string | 空        | 自定义伴侣全局安全提示词 |
| maxUserCompanions         | number | **10**    | 每用户有效自定义伴侣上限（建议 1–100） |

### ChatSettings

| 字段             | 类型     | 默认值    | 说明                 |
|------------------|----------|-----------|----------------------|
| defaultProvider  | string   | undefined | 默认聊天提供商 ID    |
| enabledProviders | string[] | `[]`      | 启用的提供商/模型 key 列表（`{providerId}` 或 `{providerId}#{modelName}`） |
| temperature      | number   | 0.7       | 温度参数（0-2）      |

### Requirement: GET /settings/chat/providers 可用模型列表

`GET /settings/chat/providers` MUST 返回当前用户可见的 Chat 可用模型提供商列表（掩码后的 `builtIn` / `custom`）。列表项为 **Provider 级**（含 `models[]`）；Web 客户端再展开为模型级 key（`{providerId}#{modelName}`）。

#### Scenario: 按 enabledProviders 过滤

- **WHEN** `chat.enabledProviders` 非空
- **THEN** 响应 `builtIn` MUST 仅包含这些 key 解析出的、且含至少一个启用 LLM 模型的 Provider（同 provider 去重）

#### Scenario: enabledProviders 为空时回退

- **WHEN** `chat.enabledProviders` 为空数组
- **THEN** 系统 MUST 回退为配置池中所有「已启用且含启用 LLM 模型」的 Provider
- **AND** MUST NOT 因 enabledProviders 为空而永久返回空列表（池中确有可用 LLM 时）

#### Scenario: 无可用 LLM

- **WHEN** 配置池中不存在任何启用的 LLM 模型
- **THEN** 响应可返回空 `builtIn`/`custom`，Web 客户端 MUST 允许用户打开选择器并提示配置/重试

### RagSettings

| 字段                         | 类型                 | 默认值                                            | 说明 |
|------------------------------|----------------------|---------------------------------------------------|------|
| llmProvider                  | string               | undefined                                         | 知识问答 LLM 提供商引用（可选；Chat 路径多用 chat.defaultProvider） |
| embeddingProvider            | string               | undefined                                         | Embedding 提供商/模型 key；**索引与问答向量空间 MUST 共用解析** |
| rerankerProvider             | string               | undefined                                         | HTTP API Rerank 提供商/模型 key（可选；失败 R1 降级） |
| retrievalMode                | `'strict'\|'loose'`  | `'strict'`                                        | 空检索语义；Phase 1 验收默认 **strict** |
| timeoutMs                    | number               | 60000                                             | 相关超时（可与 `KNOWLEDGE_AI_GENERATION_TIMEOUT_MS` 叠加） |
| rerankerAllowedModelPrefixes | string[]             | `['BAAI/', 'Xorbits/', 'sentence-transformers/']` | 遗留本地 BGE 白名单字段；权威路径已改为 API Rerank，MAY 保留兼容 |

### IndexingSettings

| 字段                | 类型                                         | 默认值               | 说明               |
|---------------------|----------------------------------------------|----------------------|--------------------|
| contextualEmbedding | boolean                                      | false                | 是否启用上下文嵌入 |
| contextualWindow    | number                                       | 1                    | 上下文窗口大小     |
| parentChunkSize     | number                                       | 800                  | 父 Chunk 大小      |
| childChunkSize      | number                                       | 150                  | 子 Chunk 大小      |
| synonymDict         | Record<'zh'\|'en', Record<string, string[]>> | `{ zh: {}, en: {} }` | 同义词词典         |

### AppearanceSettings

| 字段          | 类型                      | 默认值  | 说明            |
|---------------|---------------------------|---------|-----------------|
| mode          | 'light'\|'dark'\|'system' | 'light' | 主题模式        |
| fontSizeLevel | number                    | 3       | 字号级别（1-5） |

## Error Codes（错误码）

| 错误码                          | 说明                     |
|---------------------------------|--------------------------|
| `CATEGORY_READ_ONLY`            | 用户端不允许修改该分类   |
| `INVALID_CONFIG_FIELDS`         | 用户端不允许保存指定字段 |
| `INVALID_CONFIG_CATEGORY`       | 无效的配置分类           |
| `INVALID_PROVIDER_CATEGORY`     | 该分类不支持读取可用模型 |
| `MODEL_PROVIDER_NOT_CONFIGURED` | 未配置模型提供商         |
| `MODEL_PROVIDER_NOT_FOUND`      | 引用的模型提供商不存在   |
| `MODEL_PROVIDER_TYPE_MISMATCH`  | 模型提供商类型不匹配     |
| `MODEL_PROVIDER_DISABLED`       | 模型提供商已禁用         |
| `PROVIDER_IN_USE`               | 该模型提供商仍被配置引用 |
| `INVALID_ENCRYPTED_FORMAT`      | 加密格式无效             |
| `MODEL_NOT_ENABLED`             | 指定模型在提供商中未启用 |
| `FETCH_MODELS_NOT_SUPPORTED`    | 自定义供应商不支持自动获取模型列表 |
| `UNKNOWN_PRESET`                | 未知预设供应商           |

## Events（事件）

| 事件名           | 数据                                     | 说明         |
|------------------|------------------------------------------|--------------|
| `config.changed` | `ConfigChangedEvent(category, isSystem)` | 配置变更通知 |

## Security（安全）

### API Key 保护
- 存储时使用 AES-256-GCM 加密
- 返回时使用 `MASKED:xxx` 格式掩码
- 加密密钥来自 `SETTINGS_ENCRYPTION_KEY` 环境变量

### 权限控制
- 用户端仅允许修改 `appearance` 分类
- 其他分类修改需要管理员权限
- Provider 管理需要 `modelProviders` 权限

### SSRF 防护
- `baseUrl` 使用 `validateBaseUrl` 校验，仅允许白名单域名

## Knowledge AI 连接配置（环境变量）

Nest 调用 Knowledge AI 的连接参数 **不**放在用户 Setting JSON 中，而通过环境变量配置：

| 变量 | 说明 | 默认/备注 |
|------|------|-----------|
| `KNOWLEDGE_AI_BASE_URL` | 服务根 URL（权威） | `http://127.0.0.1:8090` |
| `KNOWLEDGE_AI_URL` | 遗留别名，仅 fallback | 废弃；日志会 warn |
| `KNOWLEDGE_AI_SERVICE_TOKEN` | 共享服务令牌 | production **必填**且禁止弱默认（≥16）；空则 Nest fail-closed |
| `KNOWLEDGE_AI_CONNECT_TIMEOUT_MS` | 连接/首字节超时 | 15000 |
| `KNOWLEDGE_AI_GENERATION_TIMEOUT_MS` | 整段生成超时 | 180000 |

### Requirement: Rerank 以 API Provider 配置

系统 SHALL 允许通过设置配置 **Rerank HTTP API**（经 `rag.rerankerProvider` 指向 providers 池中的模型）。运行时 MUST 经 Nest 注入 Knowledge AI 请求的 `_provider`，MUST NOT 将进程内 FlagEmbedding/@xenova 作为唯一可配置路径。

#### Scenario: 切换 rerank 端点

- **WHEN** 配置 `rag.rerankerProvider` 指向兼容端点对应的 provider/model 并保存
- **THEN** 后续知识问答请求 MUST 在 `_provider` 中携带 rerank 字段（由 Knowledge AI 执行 HTTP 调用）

### Requirement: 检索模式 strict/loose 可配置

系统 SHALL 支持知识问答 `retrieval_mode`：`strict` 与 `loose`，**默认 MUST 为 strict**。Phase 1 **验收以 strict 为准**。

#### Scenario: 默认 strict

- **WHEN** 用户或系统未覆盖 retrieval_mode
- **THEN** Knowledge 问答 MUST 按 strict 处理空检索

### Requirement: Companion 模块全局人设与配额配置

系统配置中 `settings.companion`（CompanionSettings）MUST 在既有 `provider`（LLM 引用）之外，支持以下可选字段，并由 Admin 模块设置 UI 可编辑：

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `defaultBoundaries` | string | 空 | 自定义伴侣全局行为边界文案 |
| `defaultGuardrailsPrompt` | string | 空 | 自定义伴侣全局安全提示词 |
| `maxUserCompanions` | number | **10** | 每用户有效自定义伴侣上限（建议校验 1–100） |

上述字段为**系统级**配置（SYSTEM_CONFIG），MUST NOT 允许普通 Web 用户写入。空安全字段时，Companion 运行时 MUST 使用代码兜底（见 companion-persona），MUST NOT 以用户请求体覆盖全局安全权威。

证据来源：
- `packages/server/src/modules/settings/dto/settings.dto.ts`
- `packages/admin/src/features/module-settings/components/CompanionSettingsForm.tsx`

#### Scenario: 保存全局安全与上限

- **WHEN** 管理员在模块设置中保存 companion 分类，提交 defaultBoundaries、defaultGuardrailsPrompt、maxUserCompanions 时
- **THEN** 系统 MUST 校验并持久化到系统配置
- **AND** 后续自定义伴侣创建上限与运行时安全合并 MUST 读取更新后的值

#### Scenario: 默认上限

- **WHEN** 系统配置未显式设置 maxUserCompanions 时
- **THEN** 有效上限 MUST 为 10

#### Scenario: 非法上限

- **WHEN** 管理员提交超出允许范围的 maxUserCompanions 时
- **THEN** 系统 MUST 拒绝保存并返回校验错误

#### Scenario: Web 用户不可改

- **WHEN** 普通 Web 用户尝试修改 companion 系统配置中的安全或上限字段时
- **THEN** 系统 MUST 拒绝（无权限或接口不暴露写）

### Requirement: CompanionSettings 配置面

系统 MUST 将 `CompanionSettings`（`settings.companion`）定义为伴侣模块系统配置契约，且 MUST 至少包含：

- `provider`：Companion LLM 提供商/模型引用（既有）
- `defaultBoundaries` / `defaultGuardrailsPrompt`：自定义伴侣安全默认
- `maxUserCompanions`：自定义数量上限，默认 10

Admin「伴侣」模块设置页 MUST 在操作者具备系统配置写权限时展示并可编辑上述字段。

#### Scenario: 模块设置页展示

- **WHEN** 管理员打开 Companion 模块设置时
- **THEN** 界面 MUST 提供 LLM provider 配置，以及全局边界、安全提示词、自定义数量上限的编辑控件

## Migration（迁移）

### 遗留格式识别

系统识别两种遗留格式并自动迁移：

1. **扁平格式**：包含 `providers`、`embeddingProvider`、`temperature`、`defaultChatProvider`、`appearance`、`fontSizeLevel` 等顶级字段

2. **嵌套格式**：包含 `llm`、`rag`、`embedding`、`reranker`、`companion` 等顶级对象，且包含 `apiKey` 字段

### 迁移策略
- 读取时识别遗留格式并转换
- 异步保存迁移结果（不阻塞当前请求）
- 兼容明文遗留数据（解密失败时保留原值）

### v1 → v2 Provider 格式迁移

系统支持从 v1（单 `model` 字段）自动迁移到 v2（`models` 数组）格式：

1. **v1 格式**：Provider 含 `type`（provider 级）、`model`（单字符串）、`dimensions`、`maxLength` 字段
2. **v2 格式**：Provider 含 `models: Model[]` 数组，`type`/`dimensions`/`maxLength` 移至 Model 级
3. **迁移时机**：`ModelProviderService.migrateLegacyProvider()` 在读取 Provider 池时执行；`SettingsService.migrateProviders()` 在 `settingsSchema.parse` 前执行
4. **转换规则**：`{ model, type, dimensions, maxLength }` → `{ models: [{ name: model, type, enabled: true, dimensions?, maxLength? }] }`，同时补全 `isCompleteUrl: false`