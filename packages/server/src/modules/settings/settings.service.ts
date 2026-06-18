import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { ConfigCryptoService } from './config-crypto.service.js'
import type { SettingsDto } from './dto/settings.dto.js'

const CONFIG_KEY = 'app_config'

const DEFAULT_CONFIG = {
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
      return this.maskConfig(DEFAULT_CONFIG)
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
      return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as Record<string, unknown>
    }

    const parsed = JSON.parse(row.value) as Record<string, unknown>
    return this.decryptConfig(parsed)
  }

  async saveSettings(userId: string, dto: SettingsDto): Promise<Record<string, unknown>> {
    const existing = await this.prisma.setting.findUnique({
      where: { userId_key: { userId, key: CONFIG_KEY } },
    })

    let configToSave: Record<string, unknown>

    if (existing) {
      const existingParsed = JSON.parse(existing.value) as Record<string, unknown>
      const decrypted = this.decryptConfig(existingParsed)

      // 将 dto 合并到现有配置，保留未修改的加密字段
      const merged = JSON.parse(JSON.stringify(dto)) as Record<string, unknown>
      const mergedProviders = merged.providers as Record<string, Record<string, unknown>>
      const existingProviders = decrypted.providers as Record<string, Record<string, unknown>>

      for (const key of Object.keys(mergedProviders)) {
        const newApiKey = mergedProviders[key].apiKey as string
        if (this.crypto.isMasked(newApiKey)) {
          mergedProviders[key].apiKey = existingProviders[key]?.apiKey ?? ''
        }
      }

      const newEmbApiKey = (merged.embeddingProvider as Record<string, unknown>).apiKey as string
      if (this.crypto.isMasked(newEmbApiKey)) {
        ;(merged.embeddingProvider as Record<string, unknown>).apiKey =
          (decrypted.embeddingProvider as Record<string, unknown>)?.apiKey ?? ''
      }

      configToSave = this.encryptConfig(merged)
    } else {
      configToSave = this.encryptConfig(dto as unknown as Record<string, unknown>)
    }

    await this.prisma.setting.upsert({
      where: { userId_key: { userId, key: CONFIG_KEY } },
      create: { userId, key: CONFIG_KEY, value: JSON.stringify(configToSave) },
      update: { value: JSON.stringify(configToSave) },
    })

    return this.maskConfig(configToSave)
  }
}
