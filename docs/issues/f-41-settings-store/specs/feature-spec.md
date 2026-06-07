---
issue: f-41
type: feature-spec
status: draft
---

# f-41 Settings Store 功能规格

## 用户故事

**作为** 前端开发者
**我需要** 一个管理用户配置的 Zustand store，支持持久化读写和未保存状态追踪
**以便** Settings 页面表单能读取/修改配置，并在用户未保存离开时给出提示

## 功能边界

### 包含

- 用户配置状态（LLM provider 配置、默认 provider、temperature、embedding provider 等）
- Zustand `persist` middleware 持久化到 localStorage key `goferbot-settings`
- `isDirty` 追踪机制：对比当前 config 与上次保存的 savedConfig
- `saveConfig` / `loadConfig` / `resetToSaved` actions
- `getLLMConfig` 同步辅助方法
- `configuredProviders` 派生数据

### 不包括

- Settings UI 表单（f-48 负责）
- 后端 `/api/settings` 端点创建
- 主题切换的实际 DOM 操作（由 f-48 或其他机制处理）

## 数据模型

```typescript
// Provider 配置
interface ChatProviderConfig {
  apiKey: string
  model: string
  baseUrl: string
}

interface OllamaConfig {
  enabled: boolean
  url: string
  model: string
}

interface EmbeddingProviderConfig {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
}

// 应用配置
interface AppConfig {
  providers: {
    openai: ChatProviderConfig
    claude: ChatProviderConfig
    deepseek: ChatProviderConfig
    custom: ChatProviderConfig
    ollama: OllamaConfig
  }
  embeddingProvider: EmbeddingProviderConfig
  temperature: number
  defaultChatProvider: string
}

// Store 状态
interface SettingsState {
  config: AppConfig
  savedConfig: AppConfig  // 上次保存时的快照
  isLoading: boolean
  error: string | null

  // 派生
  isDirty: () => boolean
  configuredProviders: () => { key: string; name: string; model: string }[]

  // Actions
  loadConfig: () => Promise<void>
  saveConfig: (updates: Partial<AppConfig>) => Promise<boolean>
  updateConfig: (updates: Partial<AppConfig>) => void  // 仅更新内存，不持久化
  resetToSaved: () => void
  getLLMConfig: (providerKey?: string) => LLMConfig | null
  clearError: () => void
}
```

## API 契约

### Store 对外暴露

| 方法 | 签名 | 说明 |
|------|------|------|
| `updateConfig` | `(updates: Partial<AppConfig>) => void` | 更新内存中的 config（用于表单编辑） |
| `saveConfig` | `(updates: Partial<AppConfig>) => Promise<boolean>` | 保存到后端 + 更新 savedConfig 快照 + persist |
| `loadConfig` | `() => Promise<void>` | 从后端加载配置，合并到 config + savedConfig |
| `resetToSaved` | `() => void` | 放弃修改，config 回退到 savedConfig |
| `isDirty` | `() => boolean` | 比较 config 与 savedConfig 是否不同 |
| `getLLMConfig` | `(providerKey?: string) => LLMConfig \| null` | 获取指定或默认 provider 的 LLM 配置 |
| `configuredProviders` | `() => {key, name, model}[]` | 返回已配置的 provider 列表 |
| `clearError` | `() => void` | 清除 error |

### localStorage 持久化

- key: `goferbot-settings`
- 持久化字段：`config`（通过 `persist` middleware）
- `savedConfig` 和 `isLoading` / `error` 不持久化

## 验收标准映射

| AC | 描述 | 优先级 |
|----|------|--------|
| AC-01 | 定义 `AppConfig` / `SettingsState` 类型，包含 5 个 provider + embedding + temperature | p0 |
| AC-02 | Zustand `persist` middleware 持久化 config 到 localStorage key `goferbot-settings` | p0 |
| AC-03 | `updateConfig` 仅更新内存 config，不修改 savedConfig | p0 |
| AC-04 | `isDirty()` 正确比较 config vs savedConfig（深度比较） | p0 |
| AC-05 | `resetToSaved()` 将 config 重置为 savedConfig 快照 | p0 |
| AC-06 | `saveConfig` 调 API 保存 + 更新 savedConfig 快照 | p1 |
| AC-07 | `loadConfig` 从 API 加载 + 同时更新 config 和 savedConfig | p1 |
| AC-08 | `getLLMConfig` 返回正确的 LLMConfig（含 ollama 特殊处理） | p1 |
| AC-09 | persist hydrate 恢复后，config 与默认值正确合并 | p0 |
