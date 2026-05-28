import { Injectable, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue, Job } from 'bullmq'
import type { Redis } from 'ioredis'
import {
  createRedisConnection,
  createDocumentQueue,
  createEmbeddingQueue,
  type DocumentJobData,
  type EmbeddingJobData,
} from '../../queue/index.js'
import { WorkerService } from './worker.service.js'

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private redis!: Redis
  private documentQueue!: Queue<DocumentJobData>
  private embeddingQueue!: Queue<EmbeddingJobData>

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WorkerService))
    private readonly workerService: WorkerService,
  ) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost')
    const port = this.configService.get<number>('REDIS_PORT', 6379)
    const password = this.configService.get<string>('REDIS_PASSWORD')

    this.redis = createRedisConnection(host, port, password)

    try {
      await this.redis.ping()
    } catch {
      console.warn(`[QueueService] Redis 连接失败 (${host}:${port})，队列功能已禁用。如需使用队列，请启动 Redis 服务。`)
      await this.redis.quit().catch(() => {})
      this.redis = undefined as unknown as Redis
      return
    }

    this.documentQueue = createDocumentQueue(this.redis)
    this.embeddingQueue = createEmbeddingQueue(this.redis)

    console.log('QueueService: Redis connection established')
    this.workerService.startWorkers(this.redis)
  }

  private isEnabled(): boolean {
    return this.redis !== (undefined as unknown as Redis)
  }

  async onModuleDestroy() {
    if (!this.isEnabled()) return
    await this.documentQueue.close()
    await this.embeddingQueue.close()
    await this.redis.quit()
    console.log('QueueService: Queues and Redis connection closed')
  }

  async addDocumentJob(documentId: string, type: 'index'): Promise<Job<DocumentJobData>> {
    if (!this.isEnabled()) throw new Error('QueueService is disabled: Redis not available')
    return this.documentQueue.add('index', { documentId, type })
  }

  async addEmbeddingJob(chunkIds: string[]): Promise<Job<EmbeddingJobData>> {
    if (!this.isEnabled()) throw new Error('QueueService is disabled: Redis not available')
    return this.embeddingQueue.add('process-embedding', { chunkIds })
  }

  async getJobStatus(jobId: string): Promise<{ id: string; state: string; progress: number; data: unknown } | null> {
    if (!this.isEnabled()) return null
    const docJob = await this.documentQueue.getJob(jobId)
    if (docJob) {
      const state = await docJob.getState()
      return {
        id: docJob.id ?? jobId,
        state,
        progress: typeof docJob.progress === 'number' ? docJob.progress : 0,
        data: docJob.data,
      }
    }

    const embJob = await this.embeddingQueue.getJob(jobId)
    if (embJob) {
      const state = await embJob.getState()
      return {
        id: embJob.id ?? jobId,
        state,
        progress: typeof embJob.progress === 'number' ? embJob.progress : 0,
        data: embJob.data,
      }
    }

    return null
  }

  async getQueueStats(): Promise<{ documentQueue: Record<string, number>; embeddingQueue: Record<string, number> }> {
    if (!this.isEnabled()) {
      return {
        documentQueue: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
        embeddingQueue: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
      }
    }
    const [documentWaiting, documentActive, documentCompleted, documentFailed, documentDelayed,
           embeddingWaiting, embeddingActive, embeddingCompleted, embeddingFailed, embeddingDelayed] = await Promise.all([
      this.documentQueue.getWaitingCount(),
      this.documentQueue.getActiveCount(),
      this.documentQueue.getCompletedCount(),
      this.documentQueue.getFailedCount(),
      this.documentQueue.getDelayedCount(),
      this.embeddingQueue.getWaitingCount(),
      this.embeddingQueue.getActiveCount(),
      this.embeddingQueue.getCompletedCount(),
      this.embeddingQueue.getFailedCount(),
      this.embeddingQueue.getDelayedCount(),
    ])

    return {
      documentQueue: {
        waiting: documentWaiting,
        active: documentActive,
        completed: documentCompleted,
        failed: documentFailed,
        delayed: documentDelayed,
      },
      embeddingQueue: {
        waiting: embeddingWaiting,
        active: embeddingActive,
        completed: embeddingCompleted,
        failed: embeddingFailed,
        delayed: embeddingDelayed,
      },
    }
  }

  getDocumentQueue(): Queue<DocumentJobData> {
    if (!this.isEnabled()) throw new Error('QueueService is disabled: Redis not available')
    return this.documentQueue
  }

  getEmbeddingQueue(): Queue<EmbeddingJobData> {
    if (!this.isEnabled()) throw new Error('QueueService is disabled: Redis not available')
    return this.embeddingQueue
  }

  getRedisConnection(): Redis {
    if (!this.isEnabled()) throw new Error('QueueService is disabled: Redis not available')
    return this.redis
  }
}
