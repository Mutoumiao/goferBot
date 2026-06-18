import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const MASK_PREFIX = 'MASKED:'

export interface ConfigCryptoOptions {
  maskPrefix?: string
}

@Injectable()
export class ConfigCryptoService {
  constructor(private readonly configService: ConfigService) {}

  private getEncryptionKey(): Buffer {
    const envKey = this.configService.getOrThrow<string>('SETTINGS_ENCRYPTION_KEY')
    return Buffer.from(envKey, 'base64')
  }

  encrypt(text: string): string {
    const key = this.getEncryptionKey()
    const iv = randomBytes(16)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return (
      iv.toString('base64') + ':' + authTag.toString('base64') + ':' + encrypted.toString('base64')
    )
  }

  decrypt(encryptedText: string): string {
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

  maskValue(value: string, options?: ConfigCryptoOptions): string {
    const prefix = options?.maskPrefix ?? MASK_PREFIX
    if (!value || value.length <= 6) return prefix
    return prefix + value.slice(0, 3)
  }

  isMasked(value: string, options?: ConfigCryptoOptions): boolean {
    const prefix = options?.maskPrefix ?? MASK_PREFIX
    return value.startsWith(prefix)
  }

  /**
   * 递归加密对象中指定 key 的字符串值。
   * 默认加密 `apiKey` 字段。
   */
  encryptObject(
    obj: Record<string, unknown>,
    sensitiveKeys: string[] = ['apiKey'],
  ): Record<string, unknown> {
    const result = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>
    this.transformSensitiveValues(result, sensitiveKeys, (value) => {
      if (typeof value !== 'string' || this.isMasked(value)) return value
      return this.encrypt(value)
    })
    return result
  }

  /**
   * 递归解密对象中指定 key 的字符串值。
   * 解密失败时保留原值（兼容明文遗留）。
   */
  decryptObject(
    obj: Record<string, unknown>,
    sensitiveKeys: string[] = ['apiKey'],
  ): Record<string, unknown> {
    const result = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>
    this.transformSensitiveValues(result, sensitiveKeys, (value) => {
      if (typeof value !== 'string' || this.isMasked(value)) return value
      try {
        return this.decrypt(value)
      } catch {
        return value
      }
    })
    return result
  }

  /**
   * 递归掩码对象中指定 key 的字符串值。
   */
  maskObject(
    obj: Record<string, unknown>,
    sensitiveKeys: string[] = ['apiKey'],
  ): Record<string, unknown> {
    const result = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>
    this.transformSensitiveValues(result, sensitiveKeys, (value) => {
      if (typeof value !== 'string' || !value) return value
      return this.maskValue(value)
    })
    return result
  }

  private transformSensitiveValues(
    obj: Record<string, unknown>,
    keys: string[],
    transformer: (value: unknown) => unknown,
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      if (keys.includes(key)) {
        obj[key] = transformer(value)
      } else if (value && typeof value === 'object') {
        this.transformSensitiveValues(value as Record<string, unknown>, keys, transformer)
      }
    }
  }
}
