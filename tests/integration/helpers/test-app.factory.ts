import { Test } from '@nestjs/testing'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { PrismaService } from '../../../packages/server/src/processors/database/prisma.service.js'
import { QueueService } from '../../../packages/server/src/processors/queue/queue.service.js'
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
