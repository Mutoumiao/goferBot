import {
  Global,
  Module,
  type DynamicModule,
  type Provider,
} from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { QueueService } from './queue.service.js'
import { WorkerService } from './worker.service.js'
import {
  type DocumentJobHandler,
  type EmbeddingJobHandler,
} from '../../queue/index.js'

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
    ]

    if (options.documentHandler) {
      providers.push({
        provide: 'DOCUMENT_JOB_HANDLER',
        useValue: options.documentHandler,
      })
    }

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
