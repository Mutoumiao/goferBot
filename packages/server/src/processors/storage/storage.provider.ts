import { FactoryProvider } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MinIOStorageProvider } from '../../storage/minio.js'

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER'

export const storageProvider: FactoryProvider = {
  provide: STORAGE_PROVIDER,
  useFactory: async (configService: ConfigService) => {
    const endpoint = configService.getOrThrow<string>('MINIO_ENDPOINT')
    const url = new URL(endpoint)

    const provider = new MinIOStorageProvider({
      endPoint: url.hostname,
      port: parseInt(url.port, 10) || (url.protocol === 'https:' ? 443 : 9000),
      useSSL: url.protocol === 'https:',
      accessKey: configService.getOrThrow<string>('MINIO_ACCESS_KEY'),
      secretKey: configService.getOrThrow<string>('MINIO_SECRET_KEY'),
      bucket: configService.get<string>('MINIO_BUCKET') || 'goferbot-files',
    })

    await provider.initialize()
    return provider
  },
  inject: [ConfigService],
}
