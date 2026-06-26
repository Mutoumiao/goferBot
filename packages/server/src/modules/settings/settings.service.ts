import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { ConfigCryptoService } from './config-crypto.service.js'
import {
  APP_CONFIG_KEY,
  SETTING_CATEGORIES,
  type SettingCategory,
  SYSTEM_CONFIG_KEY,
  SYSTEM_USER_ID,
} from './constants.js'
import type { CategoryDto, Settings } from './dto/settings.dto.js'
import { settingsSchema } from './dto/settings.dto.js'
import { ModelProviderService } from './model-provider.service.js'

const DEFAULT_CONFIG: Settings = {
  providers: {},
  chat: { enabledProviders: [], temperature: 0.7 },
  rag: {
    timeoutMs: 60_000,
    rerankerAllowedModelPrefixes: ['BAAI/', 'Xorbits/', 'sentence-transformers/'],
  },
  companion: {},
  indexing: {
    contextualEmbedding: false,
    contextualWindow: 1,
    parentChunkSize: 800,
    childChunkSize: 150,
    synonymDict: { zh: {}, en: {} },
  },
  appearance: {
    mode: 'light',
    fontSizeLevel: 3,
  },
}

const LEGACY_FLAT_KEYS = [
  'providers',
  'embeddingProvider',
  'temperature',
  'defaultChatProvider',
  'appearance',
  'fontSizeLevel',
]

function isLegacyFlatConfig(config: Record<string, unknown>): boolean {
  return (
    !('chat' in config) &&
    !('rag' in config) &&
    !('llm' in config) &&
    LEGACY_FLAT_KEYS.some((key) => key in config)
  )
}

function isLegacyNestedConfig(config: Record<string, unknown>): boolean {
  if ('llm' in config) return true
  if (hasApiKey(config.rag)) return true
  if (hasApiKey(config.embedding)) return true
  if (hasApiKey(config.companion)) return true
  return false
}

function hasApiKey(value: unknown): boolean {
  return value != null && typeof value === 'object' && !Array.isArray(value) && 'apiKey' in value
}

function migrateLegacyFlatConfig(config: Record<string, unknown>): Settings {
  const base = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as Settings

  if ('providers' in config) {
    const providers = config.providers as Record<
      string,
      { name: string; apiKey: string; model: string; baseUrl: string }
    >
    for (const [id, p] of Object.entries(providers)) {
      base.providers[id] = {
        id,
        name: p.name,
        type: 'llm',
        enabled: true,
        model: p.model,
        apiKey: p.apiKey,
        baseUrl: p.baseUrl ?? '',
        timeoutMs: 300_000,
      }
    }
  }

  if ('defaultChatProvider' in config) {
    base.chat.defaultProvider = config.defaultChatProvider as string
  }
  if ('temperature' in config) {
    base.chat.temperature = config.temperature as number
  }
  if ('embeddingProvider' in config) {
    const ep = config.embeddingProvider as {
      provider?: string
      apiKey: string
      model: string
      baseUrl?: string
      dimensions?: number
    }
    const id = ep.provider ?? 'legacy-embedding'
    base.providers[id] = {
      id,
      name: id,
      type: 'embedding',
      enabled: true,
      model: ep.model,
      apiKey: ep.apiKey,
      baseUrl: ep.baseUrl ?? '',
      timeoutMs: 300_000,
      dimensions: ep.dimensions,
    }
    base.rag.embeddingProvider = id
  }
  if ('appearance' in config) {
    base.appearance.mode = config.appearance as 'light' | 'dark' | 'system'
  }
  if ('fontSizeLevel' in config) {
    base.appearance.fontSizeLevel = config.fontSizeLevel as number
  }

  return base
}

function migrateLegacyNestedConfig(config: Record<string, unknown>): Settings {
  const base = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as Settings

  if ('llm' in config) {
    const llm = config.llm as Record<string, unknown>
    if ('providers' in llm) {
      const providers = llm.providers as Record<
        string,
        { name: string; apiKey: string; model: string; baseUrl: string }
      >
      for (const [id, p] of Object.entries(providers)) {
        base.providers[id] = {
          id,
          name: p.name,
          type: 'llm',
          enabled: true,
          model: p.model,
          apiKey: p.apiKey,
          baseUrl: p.baseUrl ?? '',
          timeoutMs: 300_000,
        }
      }
    }
    if ('defaultChatProvider' in llm) {
      base.chat.defaultProvider = llm.defaultChatProvider as string
    }
    if ('temperature' in llm) {
      base.chat.temperature = llm.temperature as number
    }
  }

  if ('rag' in config) {
    const rag = config.rag as Record<string, unknown>
    if ('apiKey' in rag) {
      const id = 'legacy-rag-llm'
      base.providers[id] = {
        id,
        name: id,
        type: 'llm',
        enabled: true,
        model: rag.model as string,
        apiKey: rag.apiKey as string,
        baseUrl: (rag.baseUrl as string) ?? '',
        timeoutMs: (rag.timeoutMs as number) ?? 60_000,
      }
      base.rag.llmProvider = id
    }
  }

  if ('embedding' in config) {
    const emb = config.embedding as Record<string, unknown>
    if ('apiKey' in emb) {
      const id = (emb.provider as string) ?? 'legacy-embedding'
      base.providers[id] = {
        id,
        name: id,
        type: 'embedding',
        enabled: true,
        model: emb.model as string,
        apiKey: emb.apiKey as string,
        baseUrl: (emb.baseUrl as string) ?? '',
        timeoutMs: 300_000,
        dimensions: emb.dimensions as number | undefined,
      }
      base.rag.embeddingProvider = id
    }
  }

  if ('reranker' in config) {
    const rer = config.reranker as Record<string, unknown>
    const id = (rer.model as string) ?? 'legacy-reranker'
    base.providers[id] = {
      id,
      name: id,
      type: 'reranker',
      enabled: true,
      model: rer.model as string,
      apiKey: '',
      baseUrl: '',
      timeoutMs: 60_000,
      maxLength: rer.maxLength as number | undefined,
    }
    base.rag.rerankerProvider = id
  }

  if ('companion' in config) {
    const comp = config.companion as Record<string, unknown>
    if ('apiKey' in comp) {
      const id = (comp.model as string) ?? 'legacy-companion'
      base.providers[id] = {
        id,
        name: id,
        type: 'llm',
        enabled: true,
        model: comp.model as string,
        apiKey: comp.apiKey as string,
        baseUrl: (comp.baseUrl as string) ?? '',
        timeoutMs: (comp.timeoutMs as number) ?? 60_000,
      }
      base.companion.provider = id
    }
  }

  if ('indexing' in config) {
    base.indexing = { ...base.indexing, ...(config.indexing as Settings['indexing']) }
  }
  if ('appearance' in config) {
    const appearance = config.appearance as Record<string, unknown>
    if (typeof appearance === 'string') {
      base.appearance.mode = appearance as 'light' | 'dark' | 'system'
    } else {
      base.appearance = { ...base.appearance, ...(appearance as Settings['appearance']) }
    }
  }

  return base
}

@Injectable()
export class SettingsService {
  private readonly defaultConfig = DEFAULT_CONFIG

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: ConfigCryptoService,
    private readonly modelProviderService: ModelProviderService,
  ) {}

  // ==================== Public API: user-scoped ====================

  async getSettings(userId: string): Promise<Settings> {
    const config = await this.getMergedConfig(userId)
    return this.maskConfig(config) as Settings
  }

  async getDecryptedSettings(userId: string): Promise<Settings> {
    return this.getMergedConfig(userId)
  }

  async getCategory(userId: string, category: SettingCategory): Promise<Settings[SettingCategory]> {
    const config = await this.getMergedConfig(userId)
    return config[category]
  }

  async saveCategory(
    userId: string,
    category: SettingCategory,
    dto: CategoryDto,
  ): Promise<Settings> {
    const validated = this.validateCategory(category, dto)
    const existing = await this.getRawUserConfig(userId)
    const merged = { ...(existing ?? this.cloneDefault()), [category]: validated }
    this.modelProviderService.validateProviderReferences(merged as Settings)
    await this.persistConfig(userId, APP_CONFIG_KEY, merged)
    return this.getSettings(userId)
  }

  /**
   * 保留旧版全量保存接口，用于前端尚未迁移到分类接口时的兼容。
   */
  async saveSettings(userId: string, dto: Partial<Settings>): Promise<Settings> {
    const allowedKeys = Object.keys(this.defaultConfig)
    const dtoKeys = Object.keys(dto)
    const extraKeys = dtoKeys.filter((k) => !allowedKeys.includes(k))
    if (extraKeys.length > 0) {
      throw new BadRequestException({
        code: 'INVALID_CONFIG_FIELDS',
        message: `不允许的配置字段: ${extraKeys.join(', ')}`,
      })
    }

    const parsed = settingsSchema.partial().parse(dto)
    delete parsed.providers
    const existing = await this.getRawUserConfig(userId)
    const merged = { ...(existing ?? this.cloneDefault()), ...parsed }
    this.modelProviderService.validateProviderReferences(merged as Settings)
    await this.persistConfig(userId, APP_CONFIG_KEY, merged)
    return this.getSettings(userId)
  }

  // ==================== Public API: system-wide ====================

  async getSystemConfig(): Promise<Settings> {
    const config = await this.getMergedSystemConfig()
    return this.maskConfig(config) as Settings
  }

  async getDecryptedSystemConfig(): Promise<Settings> {
    return this.getMergedSystemConfig()
  }

  async getSystemCategory(category: SettingCategory): Promise<Settings[SettingCategory]> {
    const config = await this.getMergedSystemConfig()
    return config[category]
  }

  async saveSystemCategory(category: SettingCategory, dto: CategoryDto): Promise<Settings> {
    const validated = this.validateCategory(category, dto)
    const existing = await this.getRawConfig(SYSTEM_USER_ID, SYSTEM_CONFIG_KEY)
    const merged = { ...(existing ?? this.cloneDefault()), [category]: validated }
    this.modelProviderService.validateProviderReferences(merged as Settings)
    await this.persistConfig(SYSTEM_USER_ID, SYSTEM_CONFIG_KEY, merged)
    return this.getSystemConfig()
  }

  async saveSystemConfig(dto: Partial<Settings>): Promise<Settings> {
    const parsed = settingsSchema.partial().parse(dto)
    const existing = await this.getRawConfig(SYSTEM_USER_ID, SYSTEM_CONFIG_KEY)
    const merged = { ...(existing ?? this.cloneDefault()), ...parsed }
    this.modelProviderService.validateProviderReferences(merged as Settings)
    await this.persistConfig(SYSTEM_USER_ID, SYSTEM_CONFIG_KEY, merged)
    return this.getSystemConfig()
  }

  /**
   * 直接读取并解密系统配置的原始对象（用于 SystemConfigService 的 provider CRUD）。
   */
  async getRawSystemConfig(): Promise<Record<string, unknown> | null> {
    return this.getRawConfig(SYSTEM_USER_ID, SYSTEM_CONFIG_KEY)
  }

  // ==================== Internal helpers ====================

  private async getMergedConfig(userId: string): Promise<Settings> {
    const systemConfig = await this.getRawConfig(SYSTEM_USER_ID, SYSTEM_CONFIG_KEY)
    const userConfig = await this.getRawConfig(userId, APP_CONFIG_KEY)
    let merged = this.cloneDefault()
    if (systemConfig) {
      merged = this.mergeDeep(merged, systemConfig) as Settings
    }
    if (userConfig) {
      const userOnly = { ...userConfig }
      if (
        userOnly.providers &&
        typeof userOnly.providers === 'object' &&
        !Array.isArray(userOnly.providers)
      ) {
        // ponytail: provider 池以系统配置为准，用户自定义 provider 仅作为补充
        userOnly.providers = {
          ...(userOnly.providers as Record<string, unknown>),
          ...(merged.providers as Record<string, unknown>),
        }
      }
      merged = this.mergeDeep(merged, userOnly) as Settings
    }
    const parsed = settingsSchema.parse(merged)
    this.modelProviderService.validateProviderReferences(parsed)
    return parsed
  }

  private async getMergedSystemConfig(): Promise<Settings> {
    const config = await this.getRawConfig(SYSTEM_USER_ID, SYSTEM_CONFIG_KEY)
    const merged = config
      ? (this.mergeDeep(this.cloneDefault(), config) as Settings)
      : this.cloneDefault()
    const parsed = settingsSchema.parse(merged)
    this.modelProviderService.validateProviderReferences(parsed)
    return parsed
  }

  private async getRawUserConfig(userId: string): Promise<Record<string, unknown> | null> {
    return this.getRawConfig(userId, APP_CONFIG_KEY)
  }

  private async getRawConfig(userId: string, key: string): Promise<Record<string, unknown> | null> {
    const row = await this.prisma.setting.findUnique({
      where: { userId_key: { userId, key } },
    })
    if (!row) return null

    const parsed = JSON.parse(row.value) as Record<string, unknown>
    const decrypted = this.decryptConfig(parsed)

    if (isLegacyNestedConfig(decrypted)) {
      const migrated = migrateLegacyNestedConfig(decrypted)
      void this.persistConfig(userId, key, migrated).catch(() => undefined)
      return migrated
    }

    if (isLegacyFlatConfig(decrypted)) {
      const migrated = migrateLegacyFlatConfig(decrypted)
      void this.persistConfig(userId, key, migrated).catch(() => undefined)
      return migrated
    }

    return decrypted
  }

  private async persistConfig(
    userId: string,
    key: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    const encrypted = this.encryptConfig(config)
    const value = JSON.stringify(encrypted)
    await this.prisma.setting.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, value },
      update: { value },
    })
  }

  private validateCategory(category: SettingCategory, dto: CategoryDto): Settings[SettingCategory] {
    if (!SETTING_CATEGORIES.includes(category)) {
      throw new BadRequestException({
        code: 'INVALID_CONFIG_CATEGORY',
        message: `无效的配置分类: ${category}，允许: ${SETTING_CATEGORIES.join(', ')}`,
      })
    }
    const schema = settingsSchema.shape[category]
    return schema.parse(dto) as Settings[SettingCategory]
  }

  private cloneDefault(): Settings {
    return JSON.parse(JSON.stringify(this.defaultConfig)) as Settings
  }

  private maskConfig(config: Record<string, unknown>): Record<string, unknown> {
    return this.crypto.maskObject(config)
  }

  private encryptConfig(config: Record<string, unknown>): Record<string, unknown> {
    return this.crypto.encryptObject(config)
  }

  private decryptConfig(config: Record<string, unknown>): Record<string, unknown> {
    return this.crypto.decryptObject(config)
  }

  private mergeDeep(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = JSON.parse(JSON.stringify(target)) as Record<string, unknown>
    for (const [key, value] of Object.entries(source)) {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        result[key] &&
        typeof result[key] === 'object'
      ) {
        result[key] = this.mergeDeep(
          result[key] as Record<string, unknown>,
          value as Record<string, unknown>,
        )
      } else {
        result[key] = value
      }
    }
    return result
  }
}
