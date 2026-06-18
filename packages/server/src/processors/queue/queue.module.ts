import { type DynamicModule, Global, Module, type Provider, type Type } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Job } from 'bullmq'
import { type DocumentJobHandler, type EmbeddingJobHandler } from '../../queue/index.js'
import type { DocumentJobData } from '../../queue/queues.js'
import { PrismaVectorIndexer } from '../indexing/prisma-vector.indexer.js'
import { DocumentParser } from '../parser/document.parser.js'
import { IndexingWorker } from './indexing.worker.js'
import { QueueService } from './queue.service.js'
import { WorkerService } from './worker.service.js'

export interface QueueModuleOptions {
  documentHandler?: DocumentJobHandler
  embeddingHandler?: EmbeddingJobHandler
}

@Module({
  imports: [ConfigModule],
  providers: [QueueService, WorkerService],
  exports: [QueueService, WorkerService],
})
@Global()
export class QueueModule {
  private constructor() {
    // NestJS 动态模块不应被实例化
  }

  static forRoot(options: QueueModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      QueueService,
      WorkerService,
      IndexingWorker,
      DocumentParser,
      PrismaVectorIndexer,
      {
        provide: 'DOCUMENT_JOB_HANDLER',
        useFactory: (indexingWorker: IndexingWorker): DocumentJobHandler => {
          return async (job: Job<DocumentJobData>) => {
            if (job.data.type === 'index') {
              return indexingWorker.handleIndexJob(job)
            }
            throw new Error(`Unknown document job type: ${job.data.type}`)
          }
        },
        inject: [IndexingWorker],
      },
    ]

    if (options.embeddingHandler) {
      providers.push({
        provide: 'EMBEDDING_JOB_HANDLER',
        useValue: options.embeddingHandler,
      })
    }

    return {
      // biome-ignorelint: suspicious/noExplicitAny: NestJS 动态模块需要使用 Type<any>
      module: QueueModule as unknown as Type<any>,
      imports: [ConfigModule],
      providers,
      exports: [QueueService, WorkerService],
      global: true,
    }
  }
}
