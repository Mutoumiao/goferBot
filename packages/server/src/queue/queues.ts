import { Queue } from 'bullmq'
import { redis } from './redis.js'

export interface DocumentJobData {
  documentId: string
  type: 'parse' | 'reindex'
}

export interface EmbeddingJobData {
  chunkIds: string[]
  kbId: string
}

export const documentQueue = new Queue<DocumentJobData>('document-processing', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})

export const embeddingQueue = new Queue<EmbeddingJobData>('embedding-generation', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})

export type QueueName = 'document-processing' | 'embedding-generation'
