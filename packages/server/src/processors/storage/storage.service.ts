import { Inject, Injectable } from '@nestjs/common'
import { IStorageProvider } from '../../common/interfaces/IStorageProvider.js'
import { STORAGE_PROVIDER } from './storage.provider.js'

@Injectable()
export class StorageService implements IStorageProvider {
  private provider: IStorageProvider

  constructor(@Inject(STORAGE_PROVIDER) provider: IStorageProvider) {
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

  extractKeyFromUrl(url: string): string | null {
    return this.provider.extractKeyFromUrl(url)
  }

  async getPresignedUploadUrl(key: string, expiry?: number): Promise<string> {
    return this.provider.getPresignedUploadUrl(key, expiry)
  }
}
