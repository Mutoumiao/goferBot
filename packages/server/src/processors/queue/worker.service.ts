import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import {
  createDocumentWorker,
  createEmbeddingWorker,
  type DocumentJobHandler,
  type EmbeddingJobHandler,
} from '../../queue/index.js'
import { PrismaService } from '../database/prisma.service.js'

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name)
  private documentWorker?: Worker
  private embeddingWorker?: Worker;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() @Inject('DOCUMENT_JOB_HANDLER') private readonly documentHandler?: DocumentJobHandler,
    @Optional() @Inject('EMBEDDING_JOB_HANDLER') private readonly embeddingHandler?: EmbeddingJobHandler,
  ) {}

  async onModuleInit() {
    // WorkerService requires a Redis connection provided externally via startWorkers
    // because QueueService owns the Redis connection lifecycle.
  }

  async onModuleDestroy() {
    if (this.documentWorker) {
      await this.documentWorker.close()
      this.logger.log('Document worker closed')
    }
    if (this.embeddingWorker) {
      await this.embeddingWorker.close()
      this.logger.log('Embedding worker closed')
    }
  }

  startWorkers(redis: Redis): void {
    const concurrency = this.configService.get<number>('QUEUE_CONCURRENCY', 2)

    if (this.documentHandler) {
      this.documentWorker = createDocumentWorker(redis, this.documentHandler, concurrency)
      this.documentWorker.on('completed', (job) => {
        this.logger.log(`Document job ${job.id} completed`)
      })
      this.documentWorker.on('failed', async (job, err) => {
        this.logger.error(`Document job ${job?.id} failed: ${err.message}`)
        if (job?.data?.documentId) {
          await this.prisma.document
            .update({
              where: { id: job.data.documentId },
              data: {
                status: 'failed',
                errorMessage: err.message.slice(0, 500),
              },
            })
            .catch((e) => {
              this.logger.error(`Failed to update document status: ${e.message}`)
            })
        }
      })
      this.logger.log('Document worker started')
    }

    if (this.embeddingHandler) {
      this.embeddingWorker = createEmbeddingWorker(redis, this.embeddingHandler, concurrency)
      this.embeddingWorker.on('completed', (job) => {
        this.logger.log(`Embedding job ${job.id} completed`)
      })
      this.embeddingWorker.on('failed', (job, err) => {
        this.logger.error(`Embedding job ${job?.id} failed: ${err.message}`)
      })
      this.logger.log('Embedding worker started')
    }
  }
}
