import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { ConfigCryptoService } from './config-crypto.service.js'
import {
  ConfigChangedEvent,
  MODEL_PROVIDER_ERROR_CODES,
  type SettingCategory,
  SYSTEM_CONFIG_KEY,
  SYSTEM_USER_ID,
} from './constants.js'
import type { CategoryDto, ModelProvider, Settings } from './dto/settings.dto.js'
import { ModelProviderService } from './model-provider.service.js'
import { SettingsService } from './settings.service.js'

@Injectable()
export class SystemConfigService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly modelProviderService: ModelProviderService,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
    private readonly crypto: ConfigCryptoService,
  ) {}

  async getSystemConfig(): Promise<Settings> {
    return this.settingsService.getSystemConfig()
  }

  async getDecryptedSystemConfig(): Promise<Settings> {
    return this.settingsService.getDecryptedSystemConfig()
  }

  async getSystemCategory(category: SettingCategory): Promise<Settings[SettingCategory]> {
    return this.settingsService.getSystemCategory(category)
  }

  async saveSystemCategory(category: SettingCategory, dto: CategoryDto): Promise<Settings> {
    const result = await this.settingsService.saveSystemCategory(category, dto)
    this.eventEmitter.emit('config.changed', new ConfigChangedEvent(category, true))
    return result
  }

  async saveSystemConfig(dto: Partial<Settings>): Promise<Settings> {
    const result = await this.settingsService.saveSystemConfig(dto)
    for (const category of Object.keys(dto) as SettingCategory[]) {
      this.eventEmitter.emit('config.changed', new ConfigChangedEvent(category, true))
    }
    return result
  }

  // ==================== Provider Pool Management ====================

  async getProviders(): Promise<Record<string, ModelProvider>> {
    const config = await this.settingsService.getDecryptedSystemConfig()
    return config.providers
  }

  async getProvider(id: string): Promise<ModelProvider> {
    const providers = await this.getProviders()
    const provider = providers[id]
    if (!provider) {
      throw new NotFoundException({
        code: MODEL_PROVIDER_ERROR_CODES.NOT_FOUND,
        message: `模型提供商不存在：${id}`,
      })
    }
    return provider
  }

  async saveProvider(dto: ModelProvider): Promise<ModelProvider> {
    const raw = await this.settingsService.getRawSystemConfig()
    const existingProviders = ((raw?.providers as Record<string, ModelProvider>) ?? {}) as Record<
      string,
      ModelProvider
    >
    const existing = existingProviders[dto.id]
    const provider = this.modelProviderService.unmaskApiKey(existing, dto)

    const providers = { ...existingProviders, [dto.id]: provider }
    const merged = { ...(raw ?? {}), providers }
    await this.settingsService.saveSystemConfig(merged as Partial<Settings>)
    this.eventEmitter.emit('config.changed', new ConfigChangedEvent('providers', true))
    return provider
  }

  async deleteProvider(id: string): Promise<void> {
    const config = await this.settingsService.getDecryptedSystemConfig()
    if (!config.providers[id]) {
      throw new NotFoundException({
        code: MODEL_PROVIDER_ERROR_CODES.NOT_FOUND,
        message: `模型提供商不存在：${id}`,
      })
    }

    const refs = this.modelProviderService.collectProviderReferences(config)
    const systemRefs = refs[id] ?? []
    const userRefs = await this.collectUserProviderReferences(id)
    const allRefs = [...systemRefs, ...userRefs]

    if (allRefs.length > 0) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.IN_USE,
        message: `该模型提供商仍被以下配置引用，无法删除：${allRefs.join(', ')}`,
      })
    }

    const raw = await this.settingsService.getRawSystemConfig()
    if (!raw) return
    const providers = { ...(raw.providers as Record<string, ModelProvider>) }
    delete providers[id]
    const merged = { ...raw, providers }
    await this.settingsService.saveSystemConfig(merged as Partial<Settings>)
    this.eventEmitter.emit('config.changed', new ConfigChangedEvent('providers', true))
  }

  async reloadModels(): Promise<void> {
    const categories: Array<SettingCategory | 'providers'> = [
      'providers',
      'chat',
      'rag',
      'companion',
      'indexing',
    ]
    for (const category of categories) {
      this.eventEmitter.emit('config.changed', new ConfigChangedEvent(category, true))
    }
  }

  private async collectUserProviderReferences(providerId: string): Promise<string[]> {
    const rows = await this.prisma.setting.findMany({
      where: { key: SYSTEM_CONFIG_KEY, NOT: { userId: SYSTEM_USER_ID } },
    })

    const paths: string[] = []
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.value) as Record<string, unknown>
        const decrypted = this.crypto.decryptObject(parsed)
        const settings = decrypted as Partial<Settings>
        const refs: string[] = []
        if (settings.chat?.defaultProvider === providerId)
          refs.push(`user:${row.userId}.chat.defaultProvider`)
        if (settings.chat?.enabledProviders?.includes(providerId))
          refs.push(`user:${row.userId}.chat.enabledProviders`)
        if (settings.rag?.llmProvider === providerId)
          refs.push(`user:${row.userId}.rag.llmProvider`)
        if (settings.rag?.embeddingProvider === providerId)
          refs.push(`user:${row.userId}.rag.embeddingProvider`)
        if (settings.rag?.rerankerProvider === providerId)
          refs.push(`user:${row.userId}.rag.rerankerProvider`)
        if (settings.companion?.provider === providerId)
          refs.push(`user:${row.userId}.companion.provider`)
        paths.push(...refs)
      } catch {
        // 忽略无法解析的用户配置
      }
    }
    return paths
  }
}
