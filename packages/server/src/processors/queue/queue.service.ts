import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Job, Queue } from 'bullmq'
import type { Redis } from 'ioredis'
import {
  type ChatFinalizeJobData,
  createChatFinalizeQueue,
  createDocumentQueue,
  createEmbeddingQueue,
  createRedisConnection,
  type DocumentJobData,
  type EmbeddingJobData,
} from '../../queue/index.js'
import { WorkerService } from './worker.service.js'

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private redis?: Redis
  private documentQueue!: Queue<DocumentJobData>
  private embeddingQueue!: Queue<EmbeddingJobData>
  private chatFinalizeQueue!: Queue<ChatFinalizeJobData>
  private readonly logger = new Logger(QueueService.name)

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
      this.logger.warn(
        `Redis 连接失败 (${host}:${port})，队列功能已禁用。如需使用队列，请启动 Redis 服务。`,
      )
      await this.redis.quit().catch(() => {})
      this.redis = undefined
      return
    }

    this.documentQueue = createDocumentQueue(this.redis)
    this.embeddingQueue = createEmbeddingQueue(this.redis)
    this.chatFinalizeQueue = createChatFinalizeQueue(this.redis)

    this.logger.log('Redis connection established')
    this.workerService.startWorkers(this.redis)

    this.redis.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`)
    })
  }

  private isEnabled(): boolean {
    return this.redis !== undefined && this.redis.status === 'ready'
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isEnabled()) return false
    try {
      await this.redis?.ping()
      return true
    } catch {
      return false
    }
  }

  async onModuleDestroy() {
    if (!this.isEnabled()) return
    await this.documentQueue.close()
    await this.embeddingQueue.close()
    await this.chatFinalizeQueue.close()
    await this.redis?.quit()
    this.logger.log('Queues and Redis connection closed')
  }

  /**
   * Enqueue document index job with per-document_id serial semantics.
   * Same jobId replaces completed/failed jobs and skips if one is already active/waiting.
   */
  async addDocumentJob(documentId: string, type: 'index'): Promise<Job<DocumentJobData>> {
    if (!this.isEnabled()) throw new Error('QueueService is disabled: Redis not available')
    // BullMQ custom jobId cannot contain ':'
    const jobId = `doc-index-${documentId}`
    const existing = await this.documentQueue.getJob(jobId)
    if (existing) {
      const state = await existing.getState()
      if (state === 'active' || state === 'waiting' || state === 'delayed' || state === 'prioritized') {
        this.logger.warn(`Index job already ${state} for document ${documentId}; reusing job ${jobId}`)
        return existing
      }
      await existing.remove().catch(() => undefined)
    }
    return this.documentQueue.add(
      'index',
      { documentId, type },
      {
        jobId,
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    )
  }

  async addEmbeddingJob(chunkIds: string[]): Promise<Job<EmbeddingJobData>> {
    if (!this.isEnabled()) throw new Error('QueueService is disabled: Redis not available')
    return this.embeddingQueue.add('process-embedding', { chunkIds })
  }

  async addChatFinalizeJob(payload: ChatFinalizeJobData): Promise<Job<ChatFinalizeJobData>> {
    if (!this.isEnabled()) throw new Error('QueueService is disabled: Redis not available')
    return this.chatFinalizeQueue.add('finalize-chat', payload)
  }

  async getJobStatus(
    jobId: string,
  ): Promise<{ id: string; state: string; progress: number; data: unknown } | null> {
    if (!this.isEnabled()) return null
    return (
      (await this.resolveJobStatus(this.documentQueue, jobId)) ??
      (await this.resolveJobStatus(this.embeddingQueue, jobId)) ??
      (await this.resolveJobStatus(this.chatFinalizeQueue, jobId)) ??
      null
    )
  }

  private async resolveJobStatus(
    queue: Queue,
    jobId: string,
  ): Promise<{ id: string; state: string; progress: number; data: unknown } | null> {
    const job = await queue.getJob(jobId)
    if (!job) return null
    const state = await job.getState()
    return {
      id: job.id ?? jobId,
      state,
      progress: typeof job.progress === 'number' ? job.progress : 0,
      data: job.data,
    }
  }

  async getQueueStats(): Promise<{
    documentQueue: Record<string, number>
    embeddingQueue: Record<string, number>
    chatFinalizeQueue: Record<string, number>
  }> {
    if (!this.isEnabled()) {
      return {
        documentQueue: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
        embeddingQueue: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
        chatFinalizeQueue: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
      }
    }
    // ponytail: getJobCounts() returns all counts in one Redis call per queue (3 total vs 15 before)
    const [docCounts, embCounts, chatCounts] = await Promise.all([
      this.documentQueue.getJobCounts(),
      this.embeddingQueue.getJobCounts(),
      this.chatFinalizeQueue.getJobCounts(),
    ])

    return {
      documentQueue: {
        waiting: docCounts.waiting,
        active: docCounts.active,
        completed: docCounts.completed,
        failed: docCounts.failed,
        delayed: docCounts.delayed,
      },
      embeddingQueue: {
        waiting: embCounts.waiting,
        active: embCounts.active,
        completed: embCounts.completed,
        failed: embCounts.failed,
        delayed: embCounts.delayed,
      },
      chatFinalizeQueue: {
        waiting: chatCounts.waiting,
        active: chatCounts.active,
        completed: chatCounts.completed,
        failed: chatCounts.failed,
        delayed: chatCounts.delayed,
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

  getChatFinalizeQueue(): Queue<ChatFinalizeJobData> {
    if (!this.isEnabled()) throw new Error('QueueService is disabled: Redis not available')
    return this.chatFinalizeQueue
  }

  getRedisConnection(): Redis {
    if (!this.isEnabled()) throw new Error('QueueService is disabled: Redis not available')
    const redis = this.redis
    if (!redis) throw new Error('QueueService: Redis not initialized')
    return redis
  }
}
