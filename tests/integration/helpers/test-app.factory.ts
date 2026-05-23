import { Test } from '@nestjs/testing'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { CanActivate } from '@nestjs/common'
import { PrismaService } from '../../../packages/server/src/processors/database/prisma.service.js'
import { QueueService } from '../../../packages/server/src/processors/queue/queue.service.js'
import { VectorService } from '../../../packages/server/src/processors/vector/vector.service.js'
import { StorageService } from '../../../packages/server/src/processors/storage/storage.service.js'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { AppModule } from '../../../packages/server/src/app.module.js'
import { bootstrap } from '../../../packages/server/src/bootstrap.js'

const mockQueueService = {
  onModuleInit: async () => {},
  onModuleDestroy: async () => {},
  addDocumentJob: async () => null,
  addEmbeddingJob: async () => null,
  getJobStatus: async () => null,
  getQueueStats: async () => ({
    documentQueue: {},
    embeddingQueue: {},
  }),
  getDocumentQueue: () => null,
  getEmbeddingQueue: () => null,
  getRedisConnection: () => null,
}

const mockVectorService = {
  onModuleInit: async () => {},
  ensureCollection: async () => {},
  insertVectors: async () => {},
  searchVectors: async () => [],
  deleteByIds: async () => {},
  deleteByFileId: async () => {},
  deleteByKbId: async () => {},
}

const mockStorageService = {
  uploadFile: async () => 'mock-key',
  downloadFile: async () => Buffer.from(''),
  deleteFile: async () => {},
  getUrl: () => 'http://mock.url',
  getPresignedUploadUrl: async () => 'http://mock.url',
}

class NoOpThrottlerGuard implements CanActivate {
  canActivate() {
    return true
  }
}

export class TestAppFactory {
  static async create(dbUrl: string): Promise<NestFastifyApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(
        new PrismaService({
          datasources: { db: { url: dbUrl } },
        }),
      )
      .overrideProvider(QueueService)
      .useValue(mockQueueService)
      .overrideProvider(VectorService)
      .useValue(mockVectorService)
      .overrideProvider(StorageService)
      .useValue(mockStorageService)
      .overrideModule(ThrottlerModule)
      .useModule(
        ThrottlerModule.forRoot([
          { name: 'default', ttl: 60000, limit: 9999 },
          { name: 'auth', ttl: 60000, limit: 9999 },
        ]),
      )
      .compile()

    const app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ bodyLimit: 1048576 }),
    )

    await bootstrap(app)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()

    return app
  }
}
