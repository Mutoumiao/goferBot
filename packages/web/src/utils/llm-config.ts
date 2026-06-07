// ---- 类型定义 ----
export interface ChatProviderConfig {
  apiKey: string
  model: string
  baseUrl: string
}

export interface OllamaConfig {
  enabled: boolean
  url: string
  model: string
}

export interface EmbeddingProviderConfig {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
}

export interface AppConfig {
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

export interface LLMConfig {
  provider: string
  model: string
  baseUrl: string
  apiKey: string
}

// ---- 常量 ----
export const DEFAULT_CONFIG: AppConfig = {
  providers: {
    openai: { apiKey: '', model: 'gpt-4o', baseUrl: '' },
    claude: { apiKey: '', model: 'claude-3-5-sonnet-20241022', baseUrl: '' },
    deepseek: { apiKey: '', model: 'deepseek-chat', baseUrl: '' },
    custom: { apiKey: '', model: '', baseUrl: '' },
    ollama: { enabled: false, url: 'http://localhost:11434', model: '' },
  },
  embeddingProvider: {
    provider: 'openai',
    apiKey: '',
    model: 'text-embedding-3-small',
    baseUrl: '',
  },
  temperature: 0.7,
  defaultChatProvider: 'deepseek',
}

const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  claude: 'Claude',
  deepseek: 'DeepSeek',
  custom: '自定义',
  ollama: 'Ollama',
}

// ---- 纯函数工具 ----

/** 获取 LLM 调用所需的 provider/model/baseUrl/apiKey */
export function getLLMConfig(config: AppConfig, providerKey?: string): LLMConfig | null {
  const key = providerKey || config.defaultChatProvider

  const providers = config.providers as Record<string, ChatProviderConfig | OllamaConfig>
  const pc = providers[key]
  if (!pc) return null

  if (key === 'ollama') {
    const oc = pc as OllamaConfig
    if (!oc.enabled) return null
    return { provider: 'ollama', model: oc.model, baseUrl: oc.url, apiKey: '' }
  }

  const cc = pc as ChatProviderConfig
  return { provider: key, model: cc.model, baseUrl: cc.baseUrl, apiKey: cc.apiKey }
}

/** 获取已配置的 provider 列表（apiKey 非空或 ollama enabled） */
export function configuredProviders(config: AppConfig): { key: string; name: string; model: string }[] {
  const list: { key: string; name: string; model: string }[] = []

  for (const [key, p] of Object.entries(config.providers)) {
    if (key === 'ollama') {
      if ((p as OllamaConfig).enabled) {
        list.push({ key, name: PROVIDER_NAMES[key] || key, model: (p as OllamaConfig).model })
      }
    } else {
      if ((p as ChatProviderConfig).apiKey) {
        list.push({ key, name: PROVIDER_NAMES[key] || key, model: (p as ChatProviderConfig).model })
      }
    }
  }

  return list
}

/** 深度合并 AppConfig — 正确处理 providers 和 embeddingProvider 的嵌套结构 */
export function mergeAppConfig(base: AppConfig, partial: Partial<AppConfig>): AppConfig {
  return {
    ...base,
    ...partial,
    providers: partial.providers
      ? { ...base.providers, ...partial.providers }
      : base.providers,
    embeddingProvider: partial.embeddingProvider
      ? { ...base.embeddingProvider, ...partial.embeddingProvider }
      : base.embeddingProvider,
  }
}
