import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { AppModule } from '../../../packages/server/src/app.module.js'
import { bootstrap } from '../../../packages/server/src/bootstrap.js'
import { PrismaService } from '../../../packages/server/src/processors/database/prisma.service.js'
import { QueueService } from '../../../packages/server/src/processors/queue/queue.service.js'
import { StorageService } from '../../../packages/server/src/processors/storage/storage.service.js'

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

const mockStorageService = {
  uploadFile: async () => 'mock-key',
  downloadFile: async () => Buffer.from(''),
  deleteFile: async () => {},
  getUrl: () => 'http://mock.url',
  getPresignedUploadUrl: async () => 'http://mock.url',
}

export interface CreateAppOptions {
  realMode?: boolean
  mockQueue?: boolean
}

export class TestAppFactory {
  private constructor() {
    // 工厂类不应被实例化
  }

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

    // realMode=false 时 mock Queue + Storage；realMode=true 默认走真实依赖。
    // mockQueue=true 可在 realMode 下单独禁用队列，避免 Worker 异步干扰。
    // VectorService 已随旧 Nest RAG 移除，向量检索由 Knowledge AI 负责。
    if (!realMode || mockQueue) {
      moduleRef.overrideProvider(QueueService).useValue(mockQueueService)
    }

    if (!realMode) {
      moduleRef.overrideProvider(StorageService).useValue(mockStorageService)
    }

    const compiled = await moduleRef.compile()

    // bodyLimit 与 multipart 50MB 对齐，避免大文件 inject 被 Fastify 默认 1MB 拦截
    const app = compiled.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ bodyLimit: 50 * 1024 * 1024 }),
    )

    await bootstrap(app)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()

    return app
  }
}
