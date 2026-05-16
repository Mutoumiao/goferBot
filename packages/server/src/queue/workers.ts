import { Worker, Job } from 'bullmq'
import { redis } from './redis.js'
import { DocumentJobData, EmbeddingJobData } from './queues.js'

const concurrency = Number(process.env.QUEUE_CONCURRENCY) || 2

// 占位处理器：document-processing
async function processDocumentJob(job: Job<DocumentJobData>): Promise<void> {
  const { documentId, type } = job.data

  if (type === 'parse') {
    // parse 阶段
    await job.updateProgress(10)
    // Phase 5: update documents.status = 'parsing'
    await new Promise((r) => setTimeout(r, 100))

    // chunk 阶段
    await job.updateProgress(40)
    // Phase 5: update documents.status = 'chunking'
    await new Promise((r) => setTimeout(r, 100))

    // embed 阶段
    await job.updateProgress(70)
    // Phase 5: update documents.status = 'indexing'
    await new Promise((r) => setTimeout(r, 100))

    // 完成
    await job.updateProgress(100)
    // Phase 5: update documents.status = 'ready'
    return
  }

  if (type === 'reindex') {
    await job.updateProgress(100)
    return
  }

  throw new Error(`Unknown job type: ${type}`)
}

// 占位处理器：embedding-generation
async function processEmbeddingJob(job: Job<EmbeddingJobData>): Promise<void> {
  const { chunkIds, kbId } = job.data
  // Phase 5 前为占位实现
  await job.updateProgress(100)
}

export const documentWorker = new Worker<DocumentJobData>(
  'document-processing',
  processDocumentJob,
  { connection: redis, concurrency }
)

export const embeddingWorker = new Worker<EmbeddingJobData>(
  'embedding-generation',
  processEmbeddingJob,
  { connection: redis, concurrency }
)

// 优雅关闭
function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}, shutting down workers...`)
  Promise.all([
    documentWorker.close(),
    embeddingWorker.close(),
  ]).then(() => {
    process.exit(0)
  })
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
