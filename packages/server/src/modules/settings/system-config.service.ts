import { createRequire } from 'node:module'
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
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
import type { CategoryDto, ModelProvider, ProviderType, Settings } from './dto/settings.dto.js'
import { ModelProviderService, parseModelKey } from './model-provider.service.js'
import { SettingsService } from './settings.service.js'

const require = createRequire(import.meta.url)
const providerPresets = require('./presets/providers.json') as ProviderPreset[]

export interface ProviderPreset {
  key: string
  label: string
  name: string
  baseUrl: string
}

export interface FetchedModel {
  name: string
  type: ProviderType
  dimensions?: number
  maxLength?: number
}

export interface FetchModelsResult {
  success: boolean
  models: FetchedModel[]
  error?: string
}

@Injectable()
export class SystemConfigService {
  private readonly logger = new Logger(SystemConfigService.name)

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
    // R2: 新建时 dto.id 为空，由后台根据名称自动生成唯一 ID；编辑时保留原 id
    const id = dto.id || this.generateProviderId(dto.name)
    const existing = existingProviders[id]
    const provider = this.modelProviderService.unmaskApiKey(existing, { ...dto, id })

    const providers = { ...existingProviders, [id]: provider }
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

  // ==================== Presets & Model Discovery ====================

  /** 返回预设提供商列表（静态 JSON 配置） */
  getPresets(): ProviderPreset[] {
    return providerPresets
  }

  /**
   * 根据 provider 名称自动生成唯一 ID：{slug}-{random4suffix}
   * slug 由名称小写化、非字母数字替换为 - 得到。
   */
  generateProviderId(name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    const suffix = Math.random().toString(36).substring(2, 6)
    return `${slug}-${suffix}`
  }

  /**
   * 代理调用远程 /models 端点，返回可用模型列表。
   * 后端统一解析 OpenAI 兼容格式，并根据模型名推断类型。
   */
  async fetchModels(dto: {
    baseUrl: string
    apiKey: string
    isCompleteUrl: boolean
  }): Promise<FetchModelsResult> {
    const url = this.resolveModelsEndpoint(dto.baseUrl, dto.isCompleteUrl)
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${dto.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
      })
      if (!resp.ok) {
        const body = await resp.text().catch(() => '')
        return {
          success: false,
          models: [],
          error: `远程返回 ${resp.status}: ${body.slice(0, 200)}`,
        }
      }
      const json = (await resp.json()) as { data?: Array<{ id: string }> }
      const rawModels = json.data ?? []
      const models: FetchedModel[] = rawModels.map((m) => ({
        name: m.id,
        type: this.inferModelType(m.id),
      }))
      return { success: true, models }
    } catch (err) {
      this.logger.warn(`fetchModels failed: ${err instanceof Error ? err.message : String(err)}`)
      return {
        success: false,
        models: [],
        error: err instanceof Error ? err.message : '请求远程模型列表失败',
      }
    }
  }

  /** 根据 baseUrl 和 isCompleteUrl 构造 /models 端点 URL */
  private resolveModelsEndpoint(baseUrl: string, isCompleteUrl: boolean): string {
    if (!isCompleteUrl) return `${baseUrl}/models`
    // ponytail: isCompleteUrl 时 baseUrl 可能含 /chat/completions 等后缀，strip 后补 /models
    const stripped = baseUrl.replace(/\/(chat\/completions|embeddings|models)$/, '')
    return `${stripped}/models`
  }

  /** 根据模型名推断类型 */
  private inferModelType(name: string): ProviderType {
    const lower = name.toLowerCase()
    if (lower.includes('embed')) return 'embedding'
    if (lower.includes('rerank')) return 'reranker'
    if (lower.includes('parser') || lower.includes('ocr')) return 'document-parser'
    return 'llm'
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
        const matches = (key: string | undefined): boolean => {
          if (!key) return false
          return parseModelKey(key).providerId === providerId
        }
        if (matches(settings.chat?.defaultProvider))
          refs.push(`user:${row.userId}.chat.defaultProvider`)
        if (settings.chat?.enabledProviders?.some(matches))
          refs.push(`user:${row.userId}.chat.enabledProviders`)
        if (matches(settings.rag?.llmProvider)) refs.push(`user:${row.userId}.rag.llmProvider`)
        if (matches(settings.rag?.embeddingProvider))
          refs.push(`user:${row.userId}.rag.embeddingProvider`)
        if (matches(settings.rag?.rerankerProvider))
          refs.push(`user:${row.userId}.rag.rerankerProvider`)
        if (matches(settings.companion?.provider))
          refs.push(`user:${row.userId}.companion.provider`)
        paths.push(...refs)
      } catch {
        // 忽略无法解析的用户配置
      }
    }
    return paths
  }
}
