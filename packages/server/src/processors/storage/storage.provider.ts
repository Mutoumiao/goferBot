import { FactoryProvider } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppException } from '../../lib/app-error.js'
import { MinIOStorageProvider } from '../../storage/minio.js'

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER'

export const storageProvider: FactoryProvider = {
  provide: STORAGE_PROVIDER,
  useFactory: async (configService: ConfigService) => {
    const endpoint = configService.get<string>('MINIO_ENDPOINT')
    const accessKey = configService.get<string>('MINIO_ACCESS_KEY')
    const secretKey = configService.get<string>('MINIO_SECRET_KEY')

    // 如果环境变量未配置，返回 null 并由调用方处理
    if (!endpoint || !accessKey || !secretKey) {
      return null
    }

    try {
      const url = new URL(endpoint)

      const provider = new MinIOStorageProvider({
        endPoint: url.hostname,
        port: parseInt(url.port, 10) || (url.protocol === 'https:' ? 443 : 9000),
        useSSL: url.protocol === 'https:',
        accessKey,
        secretKey,
        bucket: configService.get<string>('MINIO_BUCKET') || 'goferbot-files',
      })

      await provider.initialize()
      return provider
    } catch (error) {
      throw new AppException(
        'STORAGE_INIT_FAILED',
        `MinIO 存储初始化失败: ${error instanceof Error ? error.message : String(error)}`,
        500,
      )
    }
  },
  inject: [ConfigService],
}
