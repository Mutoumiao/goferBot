import { Injectable } from '@nestjs/common'
import { IStorageProvider } from '../../interfaces/IStorageProvider.js'
import { MinIOStorageProvider } from '../../storage/minio.js'

@Injectable()
export class StorageService implements IStorageProvider {
  private provider: MinIOStorageProvider

  constructor(provider: MinIOStorageProvider) {
    this.provider = provider
  }

  async uploadFile(buffer: Buffer, key: string, mimeType: string): Promise<string> {
    return this.provider.uploadFile(buffer, key, mimeType)
  }

  async downloadFile(key: string): Promise<Buffer> {
    return this.provider.downloadFile(key)
  }

  async deleteFile(key: string): Promise<void> {
    return this.provider.deleteFile(key)
  }

  getUrl(key: string): string {
    return this.provider.getUrl(key)
  }

  async getPresignedUploadUrl(key: string, expiry?: number): Promise<string> {
    return this.provider.getPresignedUploadUrl(key, expiry)
  }
}
