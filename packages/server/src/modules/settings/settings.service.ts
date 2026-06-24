import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { ConfigCryptoService } from './config-crypto.service.js'
import type { SettingsDto } from './dto/settings.dto.js'

const CONFIG_KEY = 'app_config'

const DEFAULT_CONFIG: Record<string, unknown> = {
  providers: {
    openai: { name: 'OpenAI', apiKey: '', model: 'gpt-4o', baseUrl: '' },
    claude: { name: 'Claude', apiKey: '', model: 'claude-3-5-sonnet-20241022', baseUrl: '' },
    deepseek: { name: 'DeepSeek', apiKey: '', model: 'deepseek-chat', baseUrl: '' },
  },
  embeddingProvider: {
    provider: 'openai',
    apiKey: '',
    model: 'text-embedding-3-small',
    baseUrl: '',
  },
  temperature: 0.7,
  defaultChatProvider: 'deepseek',
  appearance: 'light',
  fontSizeLevel: 3,
}

@Injectable()
export class SettingsService {
  private readonly defaultConfig = DEFAULT_CONFIG

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: ConfigCryptoService,
  ) {}

  private maskConfig(config: Record<string, unknown>): Record<string, unknown> {
    return this.crypto.maskObject(config)
  }

  private encryptConfig(config: Record<string, unknown>): Record<string, unknown> {
    return this.crypto.encryptObject(config)
  }

  private decryptConfig(config: Record<string, unknown>): Record<string, unknown> {
    return this.crypto.decryptObject(config)
  }

  async getSettings(userId: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.setting.findUnique({
      where: { userId_key: { userId, key: CONFIG_KEY } },
    })

    if (!row) {
      return this.maskConfig(this.defaultConfig)
    }

    const parsed = JSON.parse(row.value) as Record<string, unknown>
    const decrypted = this.decryptConfig(parsed)
    return this.maskConfig(decrypted)
  }

  /**
   * 服务端内部使用：返回解密后的原始配置（不掩码）。
   * 用于需要真实 API Key 的后端服务（如 ChatService）。
   */
  async getDecryptedSettings(userId: string): Promise<Record<string, unknown>> {
    const row = await this.prisma.setting.findUnique({
      where: { userId_key: { userId, key: CONFIG_KEY } },
    })

    if (!row) {
      return JSON.parse(JSON.stringify(this.defaultConfig)) as Record<string, unknown>
    }

    const parsed = JSON.parse(row.value) as Record<string, unknown>
    return this.decryptConfig(parsed)
  }

  async saveSettings(userId: string, dto: SettingsDto): Promise<Record<string, unknown>> {
    // C3: 字段白名单校验，仅允许 defaultConfig 中定义的顶层字段
    const allowedKeys = Object.keys(this.defaultConfig)
    const dtoKeys = Object.keys(dto)
    const extraKeys = dtoKeys.filter((k) => !allowedKeys.includes(k))
    if (extraKeys.length > 0) {
      throw new BadRequestException({
        code: 'INVALID_CONFIG_FIELDS',
        message: `不允许的配置字段: ${extraKeys.join(', ')}`,
      })
    }

    const existing = await this.prisma.setting.findUnique({
      where: { userId_key: { userId, key: CONFIG_KEY } },
    })

    let configToSave: Record<string, unknown>

    if (existing) {
      const existingParsed = JSON.parse(existing.value) as Record<string, unknown>
      const decrypted = this.decryptConfig(existingParsed)
      configToSave = { ...decrypted, ...dto }
    } else {
      configToSave = { ...this.defaultConfig, ...dto }
    }

    const encrypted = this.encryptConfig(configToSave)
    const value = JSON.stringify(encrypted)

    await this.prisma.setting.upsert({
      where: { userId_key: { userId, key: CONFIG_KEY } },
      create: { userId, key: CONFIG_KEY, value },
      update: { value },
    })

    return this.maskConfig(configToSave)
  }
}
