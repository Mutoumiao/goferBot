import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { ConfigCryptoService } from './config-crypto.service.js'
import { MODEL_PROVIDER_ERROR_CODES, SYSTEM_CONFIG_KEY, SYSTEM_USER_ID } from './constants.js'
import type {
  Model,
  ModelProvider,
  ProviderType,
  ResolvedProvider,
  Settings,
} from './dto/settings.dto.js'

/** 模型唯一标识分隔符：{providerId}#{modelName} */
const MODEL_KEY_SEPARATOR = '#'

/**
 * 解析模型级别 key，返回 providerId 和可选的 modelName。
 * 兼容旧格式（纯 providerId）和新格式（{providerId}#{modelName}）。
 */
export function parseModelKey(key: string): { providerId: string; modelName?: string } {
  const sepIdx = key.indexOf(MODEL_KEY_SEPARATOR)
  if (sepIdx === -1) return { providerId: key }
  return { providerId: key.slice(0, sepIdx), modelName: key.slice(sepIdx + 1) }
}

/** 构造模型级别 key */
export function buildModelKey(providerId: string, modelName: string): string {
  return `${providerId}${MODEL_KEY_SEPARATOR}${modelName}`
}

@Injectable()
export class ModelProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: ConfigCryptoService,
  ) {}

  async getProviderPool(): Promise<Record<string, ModelProvider>> {
    const config = await this.getRawSystemConfig()
    const providers = (config?.providers as Record<string, unknown>) ?? {}
    return this.migrateProvidersRecord(providers)
  }

  async getProvider(id: string): Promise<ModelProvider | undefined> {
    const pool = await this.getProviderPool()
    return pool[id]
  }

  async getProvidersByType(type: ProviderType): Promise<ModelProvider[]> {
    const pool = await this.getProviderPool()
    return Object.values(pool).filter((p) => p.models.some((m) => m.type === type))
  }

  /**
   * 解析配置引用，返回 provider + model 扁平化视图。
   * refPath 指向的值可以是 {providerId}（旧格式）或 {providerId}#{modelName}（新格式）。
   */
  resolveProvider(refPath: string, expectedType: ProviderType, config: Settings): ResolvedProvider {
    const refValue = this.getRefValue(config, refPath)
    if (!refValue) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.NOT_CONFIGURED,
        message: `未配置模型提供商：${refPath}`,
      })
    }

    const { providerId, modelName } = parseModelKey(refValue)
    const provider = config.providers[providerId]
    if (!provider) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.NOT_FOUND,
        message: `引用的模型提供商不存在：${providerId}（${refPath}）`,
      })
    }

    if (!provider.enabled) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.DISABLED,
        message: `模型提供商已禁用：${providerId}`,
      })
    }

    const model = this.findModel(provider, expectedType, modelName)
    if (!model) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.TYPE_MISMATCH,
        message: `模型提供商 ${providerId} 没有启用的 ${expectedType} 模型${modelName ? `：${modelName}` : ''}`,
      })
    }

    return {
      id: provider.id,
      name: provider.name,
      notes: provider.notes,
      enabled: provider.enabled,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      isCompleteUrl: provider.isCompleteUrl,
      timeoutMs: provider.timeoutMs,
      model: model.name,
      type: model.type,
      dimensions: model.dimensions,
      maxLength: model.maxLength,
    }
  }

  validateProviderReferences(settings: Settings): void {
    if (settings.chat.defaultProvider) {
      this.resolveProvider('chat.defaultProvider', 'llm', settings)
    }
    for (const key of settings.chat.enabledProviders) {
      const { providerId, modelName } = parseModelKey(key)
      const provider = settings.providers[providerId]
      if (!provider) {
        throw new BadRequestException({
          code: MODEL_PROVIDER_ERROR_CODES.NOT_FOUND,
          message: `Chat enabledProviders 中引用的模型提供商不存在：${key}`,
        })
      }
      const model = this.findModel(provider, 'llm', modelName)
      if (!model) {
        throw new BadRequestException({
          code: MODEL_PROVIDER_ERROR_CODES.TYPE_MISMATCH,
          message: `Chat enabledProviders 中 ${key} 没有启用的 LLM 模型`,
        })
      }
      if (!provider.enabled || !model.enabled) {
        throw new BadRequestException({
          code: MODEL_PROVIDER_ERROR_CODES.DISABLED,
          message: `Chat enabledProviders 中 ${key} 已禁用`,
        })
      }
    }

    if (settings.rag.llmProvider) {
      this.resolveProvider('rag.llmProvider', 'llm', settings)
    }
    if (settings.rag.embeddingProvider) {
      this.resolveProvider('rag.embeddingProvider', 'embedding', settings)
    }
    if (settings.rag.rerankerProvider) {
      this.resolveProvider('rag.rerankerProvider', 'reranker', settings)
    }

    if (settings.companion.provider) {
      this.resolveProvider('companion.provider', 'llm', settings)
    }
  }

  unmaskApiKey(oldProvider: ModelProvider | undefined, newProvider: ModelProvider): ModelProvider {
    if (newProvider.apiKey.startsWith('MASKED:')) {
      return {
        ...newProvider,
        apiKey: oldProvider?.apiKey ?? '',
      }
    }
    return newProvider
  }

  /**
   * 收集 provider 引用关系（用于删除保护检查）。
   * 引用值可以是 {providerId} 或 {providerId}#{modelName}，均引用同一 provider。
   */
  collectProviderReferences(settings: Settings): Record<string, string[]> {
    const refs: Record<string, string[]> = {}
    const add = (key: string | undefined, path: string) => {
      if (!key) return
      const { providerId } = parseModelKey(key)
      refs[providerId] ??= []
      if (!refs[providerId].includes(path)) refs[providerId].push(path)
    }

    add(settings.chat.defaultProvider, 'chat.defaultProvider')
    for (const key of settings.chat.enabledProviders) add(key, 'chat.enabledProviders')
    add(settings.rag.llmProvider, 'rag.llmProvider')
    add(settings.rag.embeddingProvider, 'rag.embeddingProvider')
    add(settings.rag.rerankerProvider, 'rag.rerankerProvider')
    add(settings.companion.provider, 'companion.provider')

    return refs
  }

  /**
   * 将旧格式 provider（单 model 字段）迁移为新格式（models 数组）。
   * type 从 provider 级移到 model 级。
   */
  migrateLegacyProvider(raw: unknown): ModelProvider {
    const provider = raw as Record<string, unknown>
    if (Array.isArray(provider.models)) {
      return provider as unknown as ModelProvider
    }

    const { model, type, dimensions, maxLength, ...rest } = provider
    const migrated: Record<string, unknown> = { ...rest }
    if (!('isCompleteUrl' in migrated)) migrated.isCompleteUrl = false
    if (!('models' in migrated)) {
      migrated.models = model
        ? [
            {
              name: model,
              type: type ?? 'llm',
              enabled: true,
              ...(dimensions !== undefined && { dimensions }),
              ...(maxLength !== undefined && { maxLength }),
            },
          ]
        : []
    }
    return migrated as unknown as ModelProvider
  }

  /** 批量迁移 providers 记录 */
  migrateProvidersRecord(providers: Record<string, unknown>): Record<string, ModelProvider> {
    const result: Record<string, ModelProvider> = {}
    for (const [id, raw] of Object.entries(providers)) {
      if (raw && typeof raw === 'object') {
        result[id] = this.migrateLegacyProvider(raw)
      }
    }
    return result
  }

  /**
   * 在 provider 的 models 数组中查找匹配的模型。
   * 如果指定了 modelName，精确匹配；否则找第一个 enabled 且 type 匹配的模型。
   */
  private findModel(
    provider: ModelProvider,
    expectedType: ProviderType,
    modelName?: string,
  ): Model | undefined {
    if (modelName) {
      return provider.models.find(
        (m) => m.name === modelName && m.type === expectedType && m.enabled,
      )
    }
    return provider.models.find((m) => m.type === expectedType && m.enabled)
  }

  private getRefValue(config: Settings, refPath: string): string | undefined {
    const parts = refPath.split('.')
    let value: unknown = config
    for (const part of parts) {
      if (value == null || typeof value !== 'object') return undefined
      value = (value as Record<string, unknown>)[part]
    }
    return typeof value === 'string' ? value : undefined
  }

  private async getRawSystemConfig(): Promise<Record<string, unknown> | null> {
    const row = await this.prisma.setting.findUnique({
      where: { userId_key: { userId: SYSTEM_USER_ID, key: SYSTEM_CONFIG_KEY } },
    })
    if (!row) return null
    const parsed = JSON.parse(row.value) as Record<string, unknown>
    return this.crypto.decryptObject(parsed)
  }
}
