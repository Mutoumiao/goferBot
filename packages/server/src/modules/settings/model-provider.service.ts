import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { ConfigCryptoService } from './config-crypto.service.js'
import { MODEL_PROVIDER_ERROR_CODES, SYSTEM_CONFIG_KEY, SYSTEM_USER_ID } from './constants.js'
import type { ModelProvider, ProviderType, Settings } from './dto/settings.dto.js'

@Injectable()
export class ModelProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: ConfigCryptoService,
  ) {}

  async getProviderPool(): Promise<Record<string, ModelProvider>> {
    const config = await this.getRawSystemConfig()
    return (config?.providers as Record<string, ModelProvider>) ?? {}
  }

  async getProvider(id: string): Promise<ModelProvider | undefined> {
    const pool = await this.getProviderPool()
    return pool[id]
  }

  async getProvidersByType(type: ProviderType): Promise<ModelProvider[]> {
    const pool = await this.getProviderPool()
    return Object.values(pool).filter((p) => p.type === type)
  }

  resolveProvider(refPath: string, expectedType: ProviderType, config: Settings): ModelProvider {
    const providerId = this.getRefValue(config, refPath)
    if (!providerId) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.NOT_CONFIGURED,
        message: `未配置模型提供商：${refPath}`,
      })
    }

    const provider = config.providers[providerId]
    if (!provider) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.NOT_FOUND,
        message: `引用的模型提供商不存在：${providerId}（${refPath}）`,
      })
    }

    if (provider.type !== expectedType) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.TYPE_MISMATCH,
        message: `模型提供商类型不匹配：${providerId} 是 ${provider.type}，但 ${refPath} 需要 ${expectedType}`,
      })
    }

    if (!provider.enabled) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.DISABLED,
        message: `模型提供商已禁用：${providerId}`,
      })
    }

    return provider
  }

  validateProviderReferences(settings: Settings): void {
    if (settings.chat.defaultProvider) {
      this.resolveProvider('chat.defaultProvider', 'llm', settings)
    }
    for (const id of settings.chat.enabledProviders) {
      const provider = settings.providers[id]
      if (!provider) {
        throw new BadRequestException({
          code: MODEL_PROVIDER_ERROR_CODES.NOT_FOUND,
          message: `Chat enabledProviders 中引用的模型提供商不存在：${id}`,
        })
      }
      if (provider.type !== 'llm') {
        throw new BadRequestException({
          code: MODEL_PROVIDER_ERROR_CODES.TYPE_MISMATCH,
          message: `Chat enabledProviders 中 ${id} 不是 LLM 提供商`,
        })
      }
      if (!provider.enabled) {
        throw new BadRequestException({
          code: MODEL_PROVIDER_ERROR_CODES.DISABLED,
          message: `Chat enabledProviders 中 ${id} 已禁用`,
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

  collectProviderReferences(settings: Settings): Record<string, string[]> {
    const refs: Record<string, string[]> = {}
    const add = (id: string | undefined, path: string) => {
      if (!id) return
      refs[id] ??= []
      if (!refs[id].includes(path)) refs[id].push(path)
    }

    add(settings.chat.defaultProvider, 'chat.defaultProvider')
    for (const id of settings.chat.enabledProviders) add(id, 'chat.enabledProviders')
    add(settings.rag.llmProvider, 'rag.llmProvider')
    add(settings.rag.embeddingProvider, 'rag.embeddingProvider')
    add(settings.rag.rerankerProvider, 'rag.rerankerProvider')
    add(settings.companion.provider, 'companion.provider')

    return refs
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
