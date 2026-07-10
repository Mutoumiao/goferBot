import {
  type DynamicModule,
  forwardRef,
  Global,
  Module,
  type Provider,
  type Type,
} from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Job } from 'bullmq'
import { ChatModule } from '../../modules/chat/chat.module.js'
import { SettingsModule } from '../../modules/settings/settings.module.js'
import {
  type ChatFinalizeJobHandler,
  type DocumentJobHandler,
  type EmbeddingJobHandler,
} from '../../queue/index.js'
import type { ChatFinalizeJobData, DocumentJobData } from '../../queue/queues.js'
import { ChatFinalizeProcessor } from '../chat/chat-finalize.processor.js'
import { KnowledgeAiModule } from '../knowledge-ai/knowledge-ai.module.js'
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
      ChatFinalizeProcessor,
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
      {
        provide: 'CHAT_FINALIZE_JOB_HANDLER',
        useFactory: (processor: ChatFinalizeProcessor): ChatFinalizeJobHandler => {
          return async (job: Job<ChatFinalizeJobData>) => {
            return processor.process(job)
          }
        },
        inject: [ChatFinalizeProcessor],
      },
    ]

    if (options.embeddingHandler) {
      providers.push({
        provide: 'EMBEDDING_JOB_HANDLER',
        useValue: options.embeddingHandler,
      })
    }

    return {
      module: QueueModule as unknown as Type<any>,
      imports: [
        ConfigModule,
        SettingsModule,
        KnowledgeAiModule,
        forwardRef(() => ChatModule),
      ],
      providers,
      exports: [QueueService, WorkerService],
      global: true,
    }
  }
}
