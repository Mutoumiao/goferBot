import { Inject, Injectable } from '@nestjs/common'
import { IStorageProvider } from '../../common/interfaces/IStorageProvider.js'
import { AppException } from '../../lib/app-error.js'
import { STORAGE_PROVIDER } from './storage.provider.js'

@Injectable()
export class StorageService implements IStorageProvider {
  private provider: IStorageProvider | null

  constructor(@Inject(STORAGE_PROVIDER) provider: IStorageProvider | null) {
    this.provider = provider
  }

  private ensureProvider(): IStorageProvider {
    if (!this.provider) {
      throw new AppException(
        'STORAGE_NOT_CONFIGURED',
        'MinIO 存储服务未配置，操作无法执行。请设置 MINIO_ENDPOINT、MINIO_ACCESS_KEY 和 MINIO_SECRET_KEY 环境变量。',
        503,
      )
    }
    return this.provider
  }

  async uploadFile(buffer: Buffer, key: string, mimeType: string): Promise<string> {
    return this.ensureProvider().uploadFile(buffer, key, mimeType)
  }

  async downloadFile(key: string): Promise<Buffer> {
    return this.ensureProvider().downloadFile(key)
  }

  async deleteFile(key: string): Promise<void> {
    return this.ensureProvider().deleteFile(key)
  }

  getUrl(key: string): string {
    return this.ensureProvider().getUrl(key)
  }

  extractKeyFromUrl(url: string): string | null {
    const provider = this.ensureProvider()
    return provider.extractKeyFromUrl(url)
  }

  async getPresignedUploadUrl(key: string, expiry?: number): Promise<string> {
    return this.ensureProvider().getPresignedUploadUrl(key, expiry)
  }
}
