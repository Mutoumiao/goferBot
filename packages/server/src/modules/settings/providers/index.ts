import { Injectable, OnModuleInit } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { SystemConfigService } from '../system-config.service.js'
import { modelNotEnabledError, unknownPresetError } from '../errors.js'
import { BaseProvider } from './base.provider.js'
import { CustomProvider } from './custom.provider.js'
import { DeepSeekProvider } from './deepseek.provider.js'
import { OllamaProvider } from './ollama.provider.js'

/** Provider 类注册表：presetKey → Provider 子类 */
export const PROVIDER_REGISTRY: Record<string, typeof BaseProvider> = {
  deepseek: DeepSeekProvider,
  ollama: OllamaProvider,
  custom: CustomProvider,
}

@Injectable()
export class ProviderRegistry implements OnModuleInit {
  private cache = new Map<string, BaseProvider>()

  constructor(
    private readonly systemConfig: SystemConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit(): void {
    this.eventEmitter.on(
      'config.changed',
      (event: { category: string }) => {
        if (event.category === 'providers') {
          this.invalidateAll()
        }
      },
    )
  }

  /** 懒加载获取 Provider 实例 */
  async get(providerId: string, modelName: string): Promise<BaseProvider> {
    const key = `${providerId}#${modelName}`
    const cached = this.cache.get(key)
    if (cached) return cached

    const instance = await this.create(providerId, modelName)
    this.cache.set(key, instance)
    return instance
  }

  /** 清除指定 provider 的所有缓存 */
  invalidate(providerId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${providerId}#`)) {
        this.cache.delete(key)
      }
    }
  }

  /** 清除全部缓存 */
  invalidateAll(): void {
    this.cache.clear()
  }

  /** 按 presetKey 创建 Provider 实例（供 fetchModels 端点使用，不缓存） */
  createFromPreset(
    presetKey: string,
    baseUrl: string,
    apiKey: string,
  ): BaseProvider {
    const ProviderClass = PROVIDER_REGISTRY[presetKey]
    if (!ProviderClass) {
      throw unknownPresetError(presetKey)
    }
    return new ProviderClass({
      id: '',
      name: presetKey,
      enabled: true,
      apiKey,
      baseUrl,
      isCompleteUrl: false,
      timeoutMs: 300_000,
      model: '',
      type: 'llm',
    })
  }

  private async create(
    providerId: string,
    modelName: string,
  ): Promise<BaseProvider> {
    const provider = await this.systemConfig.getProvider(providerId)
    const model = provider.models?.find((m) => m.name === modelName && m.enabled)
    if (!model) {
      throw modelNotEnabledError(providerId, modelName)
    }

    const ProviderClass =
      PROVIDER_REGISTRY[providerId] ?? BaseProvider

    return new ProviderClass({
      id: provider.id,
      name: provider.name,
      enabled: provider.enabled,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      isCompleteUrl: provider.isCompleteUrl,
      timeoutMs: provider.timeoutMs,
      model: model.name,
      type: model.type,
      dimensions: model.dimensions,
      maxLength: model.maxLength,
    })
  }
}
