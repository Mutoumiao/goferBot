import { constants, generateKeyPairSync, privateDecrypt } from 'node:crypto'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'

@Injectable()
export class PasswordEncryptionService implements OnModuleInit {
  private readonly logger = new Logger(PasswordEncryptionService.name)
  private privateKey: string | null = null
  private publicKeyPem: string | null = null

  onModuleInit() {
    // ponytail: 进程级动态密钥，公钥通过 GET /auth/public-key (no-store) 分发。
    // 前端 DECRYPT_FAILED 触发重新获取公钥重试，覆盖服务器重启后密钥轮换的窗口期。
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    this.publicKeyPem = publicKey
    this.privateKey = privateKey
  }

  getPublicKeyPem(): string {
    if (!this.publicKeyPem) {
      throw new Error('RSA key pair not initialized')
    }
    return this.publicKeyPem
  }

  decrypt(encryptedBase64: string): string {
    if (!this.privateKey) {
      throw new Error('RSA key pair not initialized')
    }
    const buffer = Buffer.from(encryptedBase64, 'base64')
    const decrypted = privateDecrypt(
      { key: this.privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      buffer,
    )
    return decrypted.toString('utf8')
  }
}
