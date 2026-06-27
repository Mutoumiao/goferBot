import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { ConfigChangedEvent } from '../settings/constants.js'
import type { ModelProvider } from '../settings/dto/settings.dto.js'
import { SystemConfigService } from '../settings/system-config.service.js'

export interface ModelInfo {
  providerKey: string
  providerName: string
  baseUrl: string
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

  async refresh(): Promise<void> {
    const config = await this.systemConfigService.getDecryptedSystemConfig()
    const enabledIds = config.chat?.enabledProviders ?? []
    const providers = enabledIds
      .map((id) => config.providers[id])
      .filter((p): p is ModelProvider => p?.type === 'llm' && p.enabled)

    this.models.clear()
    for (const provider of providers) {
      this.models.set(provider.id, {
        providerKey: provider.id,
        providerName: provider.name,
        baseUrl: provider.baseUrl,
      })
    }
    this.logger.debug(`Model registry refreshed: ${this.models.size} LLM providers`)
  }

  lookup(providerId: string): ModelInfo | undefined {
    return this.models.get(providerId)
  }

  list(): Array<{ key: string; name: string; model: string; isBuiltin: boolean }> {
    return Array.from(this.models.entries()).map(([id, info]) => ({
      key: id,
      name: info.providerName,
      model: id,
      isBuiltin: false,
    }))
  }
}
