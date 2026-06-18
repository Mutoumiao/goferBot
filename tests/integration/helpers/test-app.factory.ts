import type { CanActivate } from '@nestjs/common'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { AppModule } from '../../../packages/server/src/app.module.js'
import { bootstrap } from '../../../packages/server/src/bootstrap.js'
import { PrismaService } from '../../../packages/server/src/processors/database/prisma.service.js'
import { QueueService } from '../../../packages/server/src/processors/queue/queue.service.js'
import { StorageService } from '../../../packages/server/src/processors/storage/storage.service.js'
import { VectorService } from '../../../packages/server/src/processors/vector/vector.service.js'

const mockQueueService = {
  onModuleInit: async () => {},
  onModuleDestroy: async () => {},
  isHealthy: () => true,
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

export interface CreateAppOptions {
  realMode?: boolean
  mockQueue?: boolean
}

export class TestAppFactory {
  static async create(dbUrl: string, opts: CreateAppOptions = {}): Promise<NestFastifyApplication> {
    const { realMode = false, mockQueue = false } = opts

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(
        new PrismaService({
          datasources: { db: { url: dbUrl } },
        }),
      )

    // realMode=false 时全部使用 mock 服务；realMode=true 时默认使用真实 Queue/Vector/Storage。
    // 当需要在真实 Storage + Vector 环境下禁用队列（避免 Worker 异步干扰）时，可传 mockQueue=true。
    if (!realMode || mockQueue) {
      moduleRef.overrideProvider(QueueService).useValue(mockQueueService)
    }

    if (!realMode) {
      moduleRef
        .overrideProvider(VectorService)
        .useValue(mockVectorService)
        .overrideProvider(StorageService)
        .useValue(mockStorageService)
    }

    const compiled = await moduleRef.compile()

    const app = compiled.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ bodyLimit: 1048576 }),
    )

    await bootstrap(app)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()

    return app
  }
}
