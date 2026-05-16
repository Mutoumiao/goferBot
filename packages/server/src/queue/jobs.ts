import { Job } from 'bullmq'
import { documentQueue, embeddingQueue, DocumentJobData, EmbeddingJobData } from './queues.js'

export async function addDocumentJob(
  documentId: string,
  type: DocumentJobData['type']
): Promise<string> {
  const job = await documentQueue.add('process-document', { documentId, type })
  if (!job.id) {
    throw new Error('Failed to add document job: job.id is undefined')
  }
  return job.id
}

export async function addEmbeddingJob(
  chunkIds: string[],
  kbId: string
): Promise<string> {
  const job = await embeddingQueue.add('generate-embedding', { chunkIds, kbId })
  if (!job.id) {
    throw new Error('Failed to add embedding job: job.id is undefined')
  }
  return job.id
}

export interface JobStatus {
  id: string
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown'
  progress: number
  attemptsMade: number
  failedReason?: string
  finishedOn?: number
  processedOn?: number
}

export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  let job = await Job.fromId(documentQueue, jobId)

  if (!job) {
    job = await Job.fromId(embeddingQueue, jobId)
  }

  if (!job) return null

  const state = await job.getState()

  return {
    id: job.id!,
    state: state as JobStatus['state'],
    progress: (job.progress as number) ?? 0,
    attemptsMade: job.attemptsMade ?? 0,
    failedReason: job.failedReason ?? undefined,
    finishedOn: job.finishedOn ?? undefined,
    processedOn: job.processedOn ?? undefined,
  }
}

export interface QueueStats {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

export async function getQueueStats(): Promise<QueueStats[]> {
  const queues = [
    { name: 'document-processing', queue: documentQueue },
    { name: 'embedding-generation', queue: embeddingQueue },
  ]

  return Promise.all(
    queues.map(async ({ name, queue }) => {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ])

      return { name, waiting, active, completed, failed, delayed }
    })
  )
}
