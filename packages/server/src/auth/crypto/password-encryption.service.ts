import { Injectable, OnModuleInit } from '@nestjs/common'
import { generateKeyPairSync, privateDecrypt, constants } from 'crypto'

@Injectable()
export class PasswordEncryptionService implements OnModuleInit {
  private privateKey: string | null = null
  private publicKeyPem: string | null = null

  onModuleInit() {
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
