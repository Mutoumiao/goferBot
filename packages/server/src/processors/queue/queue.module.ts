import {
  Global,
  Module,
  type DynamicModule,
  type Provider,
} from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Job } from 'bullmq'
import { QueueService } from './queue.service.js'
import { WorkerService } from './worker.service.js'
import { IndexingWorker } from './indexing.worker.js'
import { DocumentParser } from '../parser/document.parser.js'
import { PrismaMilvusIndexer } from '../indexing/prisma-milvus.indexer.js'
import {
  type DocumentJobHandler,
  type EmbeddingJobHandler,
} from '../../queue/index.js'
import type { DocumentJobData } from '../../queue/queues.js'

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
  static forRoot(options: QueueModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      QueueService,
      WorkerService,
      IndexingWorker,
      DocumentParser,
      PrismaMilvusIndexer,
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
      module: QueueModule,
      imports: [ConfigModule],
      providers,
      exports: [QueueService, WorkerService],
      global: true,
    }
  }
}
