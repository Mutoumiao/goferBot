import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../processors/database/prisma.service.js'
import type { SettingsDto } from './dto/settings.dto.js'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const CONFIG_KEY = 'app_config'

const DEFAULT_CONFIG = {
  providers: {
    openai: { apiKey: '', model: 'gpt-4o', baseUrl: '' },
    claude: { apiKey: '', model: 'claude-3-5-sonnet-20241022', baseUrl: '' },
    deepseek: { apiKey: '', model: 'deepseek-chat', baseUrl: '' },
    custom: { apiKey: '', model: '', baseUrl: '' },
    ollama: { enabled: false, url: 'http://localhost:11434', model: '' },
  },
  embeddingProvider: { provider: 'openai', apiKey: '', model: 'text-embedding-3-small', baseUrl: '' },
  temperature: 0.7,
  defaultChatProvider: 'deepseek',
}

function maskApiKey(key: string): string {
  if (!key || key.length <= 6) return '****'
  return key.slice(0, 3) + '****'
}

function isMask(value: string): boolean {
  return value.endsWith('****')
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private getEncryptionKey(): Buffer {
    const envKey = this.configService.get<string>('SETTINGS_ENCRYPTION_KEY')
    if (envKey) {
      return Buffer.from(envKey, 'base64')
    }
    const jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET')
    return scryptSync(jwtSecret, 'goferbot-salt', 32)
  }

  private encrypt(text: string): string {
    const key = this.getEncryptionKey()
    const iv = randomBytes(16)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return iv.toString('base64') + ':' + authTag.toString('base64') + ':' + encrypted.toString('base64')
  }

  private decrypt(encryptedText: string): string {
    const key = this.getEncryptionKey()
    const parts = encryptedText.split(':')
    if (parts.length !== 3) throw new Error('Invalid encrypted format')
    const iv = Buffer.from(parts[0], 'base64')
    const authTag = Buffer.from(parts[1], 'base64')
    const encrypted = Buffer.from(parts[2], 'base64')
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return decrypted.toString('utf8')
  }

  private maskConfig(config: Record<string, unknown>): Record<string, unknown> {
    const result = JSON.parse(JSON.stringify(config))
    const providers = result.providers as Record<string, Record<string, unknown>>
    for (const key of Object.keys(providers)) {
      if (key === 'ollama') continue
      const apiKey = providers[key].apiKey as string
      if (apiKey) {
        providers[key].apiKey = maskApiKey(apiKey)
      }
    }
    const emb = result.embeddingProvider as Record<string, unknown>
    if (emb.apiKey) {
      emb.apiKey = maskApiKey(emb.apiKey as string)
    }
    return result
  }

  private encryptConfig(config: Record<string, unknown>): Record<string, unknown> {
    const result = JSON.parse(JSON.stringify(config))
    const providers = result.providers as Record<string, Record<string, unknown>>
    for (const key of Object.keys(providers)) {
      if (key === 'ollama') continue
      const apiKey = providers[key].apiKey as string
      if (apiKey && !isMask(apiKey)) {
        providers[key].apiKey = this.encrypt(apiKey)
      }
    }
    const emb = result.embeddingProvider as Record<string, unknown>
    if (emb.apiKey && !isMask(emb.apiKey as string)) {
      emb.apiKey = this.encrypt(emb.apiKey as string)
    }
    return result
  }

  private decryptConfig(config: Record<string, unknown>): Record<string, unknown> {
    const result = JSON.parse(JSON.stringify(config))
    const providers = result.providers as Record<string, Record<string, unknown>>
    for (const key of Object.keys(providers)) {
      if (key === 'ollama') continue
      const apiKey = providers[key].apiKey as string
      if (apiKey && !isMask(apiKey)) {
        try {
          providers[key].apiKey = this.decrypt(apiKey)
        } catch {
          // 解密失败则保留原值（可能是明文遗留）
        }
      }
    }
    const emb = result.embeddingProvider as Record<string, unknown>
    if (emb.apiKey && !isMask(emb.apiKey as string)) {
      try {
        emb.apiKey = this.decrypt(emb.apiKey as string)
      } catch {
        // 同上
      }
    }
    return result
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
        if (key === 'ollama') continue
        const newApiKey = mergedProviders[key].apiKey as string
        if (isMask(newApiKey)) {
          mergedProviders[key].apiKey = existingProviders[key]?.apiKey ?? ''
        }
      }

      const newEmbApiKey = (merged.embeddingProvider as Record<string, unknown>).apiKey as string
      if (isMask(newEmbApiKey)) {
        (merged.embeddingProvider as Record<string, unknown>).apiKey =
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
