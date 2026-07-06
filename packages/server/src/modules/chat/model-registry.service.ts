import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { ConfigChangedEvent } from '../settings/constants.js'
import type { ModelProvider } from '../settings/dto/settings.dto.js'
import { buildModelKey, parseModelKey } from '../settings/model-provider.service.js'
import { SystemConfigService } from '../settings/system-config.service.js'

export interface ModelInfo {
  providerKey: string
  providerName: string
  baseUrl: string
  isCompleteUrl: boolean
  model: string
  type: string
}

export interface ModelRegistration {
  id: string
  providerKey: string
  providerName: string
  baseUrl: string
}

@Injectable()
export class ModelRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ModelRegistryService.name)
  private models = new Map<string, ModelInfo>()

  constructor(private readonly systemConfigService: SystemConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.refresh()
  }

  @OnEvent('config.changed')
  async handleConfigChanged(event: ConfigChangedEvent): Promise<void> {
    if (event.category === 'providers' || event.category === 'chat') {
      await this.refresh()
    }
  }

  /**
   * 刷新注册表：遍历 chat.enabledProviders 引用的 provider，
   * 展开为模型级别条目（仅 enabled 的 llm 模型）。
   * key 格式：{providerId}#{modelName}
   */
  async refresh(): Promise<void> {
    const config = await this.systemConfigService.getDecryptedSystemConfig()
    const enabledKeys = config.chat?.enabledProviders ?? []

    this.models.clear()
    for (const key of enabledKeys) {
      const { providerId, modelName } = parseModelKey(key)
      const provider: ModelProvider | undefined = config.providers[providerId]
      if (!provider?.enabled) continue

      // 旧格式（纯 providerId）：展开该 provider 下所有 enabled llm 模型
      // 新格式（{providerId}#{modelName}）：仅注册指定模型
      const targetModels = modelName
        ? provider.models.filter((m) => m.name === modelName)
        : provider.models

      for (const model of targetModels) {
        if (model.type !== 'llm' || !model.enabled) continue
        const modelKey = buildModelKey(provider.id, model.name)
        this.models.set(modelKey, {
          providerKey: provider.id,
          providerName: provider.name,
          baseUrl: provider.baseUrl,
          isCompleteUrl: provider.isCompleteUrl,
          model: model.name,
          type: model.type,
        })
      }
    }
    this.logger.debug(`Model registry refreshed: ${this.models.size} LLM models`)
  }

  /**
   * 查找模型。key 可以是 {providerId}#{modelName}（新格式）或纯 {providerId}（旧格式，返回第一个匹配）。
   */
  lookup(key: string): ModelInfo | undefined {
    return this.models.get(key)
  }

  /**
   * 返回模型级别列表（扁平化），每个 enabled 的 llm 模型一条记录。
   */
  list(): Array<{ key: string; name: string; model: string; isBuiltin: boolean }> {
    return Array.from(this.models.entries()).map(([key, info]) => ({
      key,
      name: info.providerName,
      model: info.model,
      isBuiltin: false,
    }))
  }
}
