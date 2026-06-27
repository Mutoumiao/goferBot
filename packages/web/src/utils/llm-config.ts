// ---- 类型定义 ----
export interface ProviderConfig {
  name: string
  apiKey: string
  model: string
  baseUrl: string
}

export interface EmbeddingProviderConfig {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
}

export interface AppConfig {
  providers: Record<string, ProviderConfig>
  embeddingProvider: EmbeddingProviderConfig
  temperature: number
  defaultChatProvider: string
  appearance: 'light' | 'dark' | 'system'
  fontSizeLevel: 1 | 2 | 3 | 4 | 5
}

export interface LLMConfig {
  provider: string
  model: string
  baseUrl: string
  apiKey: string
}

// ---- 常量 ----
// ponytail: 不再硬编码任何默认模型/provider，所有模型由后端配置中心提供
export const DEFAULT_CONFIG: AppConfig = {
  providers: {},
  embeddingProvider: {
    provider: '',
    apiKey: '',
    model: '',
    baseUrl: '',
  },
  temperature: 0.7,
  defaultChatProvider: '',
  appearance: 'light',
  fontSizeLevel: 3,
}

// ---- 纯函数工具 ----

/** 获取 LLM 调用所需的 provider/model/baseUrl/apiKey（已废弃，保留兼容） */
export function getLLMConfig(config: AppConfig, providerKey?: string): LLMConfig | null {
  const key = providerKey || config.defaultChatProvider
  const pc = config.providers[key]
  if (!pc) return null
  return { provider: key, model: pc.model, baseUrl: pc.baseUrl, apiKey: pc.apiKey }
}

/** 获取已配置的 provider 列表（apiKey 非空）— 仅用于本地自定义模型 */
export function configuredProviders(
  config: AppConfig,
): { key: string; name: string; model: string }[] {
  const list: { key: string; name: string; model: string }[] = []
  for (const [key, p] of Object.entries(config.providers)) {
    if (p.apiKey) {
      list.push({ key, name: p.name || key, model: p.model })
    }
  }
  return list
}

/** 深度合并 AppConfig — 正确处理 providers 和 embeddingProvider 的嵌套结构 */
export function mergeAppConfig(base: AppConfig, partial: Partial<AppConfig>): AppConfig {
  return {
    ...base,
    ...partial,
    providers: partial.providers ? { ...base.providers, ...partial.providers } : base.providers,
    embeddingProvider: partial.embeddingProvider
      ? { ...base.embeddingProvider, ...partial.embeddingProvider }
      : base.embeddingProvider,
  }
}
