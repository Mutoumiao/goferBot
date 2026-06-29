import { Queue } from 'bullmq'
import type { Redis } from 'ioredis'

export const DOCUMENT_PROCESSING_QUEUE = 'document-processing'
export const EMBEDDING_QUEUE = 'embedding'
export const CHAT_FINALIZE_QUEUE = 'chat-finalize'

export interface DocumentJobData {
  documentId: string
  type: 'index'
}

export interface EmbeddingJobData {
  chunkIds: string[]
}

export interface ChatFinalizeJobData {
  sessionId: string
  messageId: string
  userId?: string
  fullReply: string
  input: string
  traceId: string
  requestId: string
}

export function createDocumentQueue(connection: Redis): Queue<DocumentJobData> {
  return new Queue<DocumentJobData>(DOCUMENT_PROCESSING_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  })
}

export function createEmbeddingQueue(connection: Redis): Queue<EmbeddingJobData> {
  return new Queue<EmbeddingJobData>(EMBEDDING_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  })
}

export function createChatFinalizeQueue(connection: Redis): Queue<ChatFinalizeJobData> {
  return new Queue<ChatFinalizeJobData>(CHAT_FINALIZE_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 200,
      removeOnFail: 50,
    },
  })
}
