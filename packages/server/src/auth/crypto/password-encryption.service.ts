import { constants, generateKeyPairSync, privateDecrypt } from 'node:crypto'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class PasswordEncryptionService implements OnModuleInit {
  private readonly logger = new Logger(PasswordEncryptionService.name)
  private privateKey: string | null = null
  private publicKeyPem: string | null = null

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const privateKeyEnv = this.configService.get<string>('RSA_PRIVATE_KEY')
    const publicKeyEnv = this.configService.get<string>('RSA_PUBLIC_KEY')

    if (privateKeyEnv && publicKeyEnv) {
      this.privateKey = privateKeyEnv.replace(/\\n/g, '\n')
      this.publicKeyPem = publicKeyEnv.replace(/\\n/g, '\n')
    } else {
      // ponytail: 开发环境自动生成密钥，但警告提示持久化到环境变量
      // 生产环境应配置 RSA_PRIVATE_KEY / RSA_PUBLIC_KEY 避免重启失效
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      })
      this.publicKeyPem = publicKey
      this.privateKey = privateKey
      this.logger.warn(
        'RSA keys generated on-the-fly. Set RSA_PRIVATE_KEY and RSA_PUBLIC_KEY in environment to persist across restarts.'
      )
    }
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
