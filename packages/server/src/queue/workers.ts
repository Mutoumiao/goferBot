import { Worker, Job } from 'bullmq'
import type { Redis } from 'ioredis'
import {
  DOCUMENT_PROCESSING_QUEUE,
  EMBEDDING_QUEUE,
  type DocumentJobData,
  type EmbeddingJobData,
} from './queues.js'

export type DocumentJobHandler = (job: Job<DocumentJobData>) => Promise<void>
export type EmbeddingJobHandler = (job: Job<EmbeddingJobData>) => Promise<void>

export interface WorkerRegistry {
  documentHandler?: DocumentJobHandler
  embeddingHandler?: EmbeddingJobHandler
}

export function createDocumentWorker(
  connection: Redis,
  handler: DocumentJobHandler,
  concurrency = 2,
): Worker<DocumentJobData> {
  return new Worker<DocumentJobData>(
    DOCUMENT_PROCESSING_QUEUE,
    async (job) => {
      await handler(job)
    },
    { connection, concurrency },
  )
}

export function createEmbeddingWorker(
  connection: Redis,
  handler: EmbeddingJobHandler,
  concurrency = 2,
): Worker<EmbeddingJobData> {
  return new Worker<EmbeddingJobData>(
    EMBEDDING_QUEUE,
    async (job) => {
      await handler(job)
    },
    { connection, concurrency },
  )
}
