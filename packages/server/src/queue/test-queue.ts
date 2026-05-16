import { Worker, Job } from 'bullmq'
import { addDocumentJob, getJobStatus } from './jobs.js'
import { documentQueue, embeddingQueue, DocumentJobData, EmbeddingJobData } from './queues.js'
import { redis } from './redis.js'

const concurrency = Number(process.env.QUEUE_CONCURRENCY) || 2

// 内联占位处理器，确保测试脚本自包含 Worker
async function processDocumentJob(job: Job<DocumentJobData>): Promise<void> {
  const { documentId, type } = job.data

  if (type === 'parse') {
    await job.updateProgress(10)
    // Phase 5: update documents.status = 'parsing'
    await new Promise((r) => setTimeout(r, 100))

    await job.updateProgress(40)
    // Phase 5: update documents.status = 'chunking'
    await new Promise((r) => setTimeout(r, 100))

    await job.updateProgress(70)
    // Phase 5: update documents.status = 'indexing'
    await new Promise((r) => setTimeout(r, 100))

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

async function processEmbeddingJob(job: Job<EmbeddingJobData>): Promise<void> {
  // Phase 5 前为占位实现
  await job.updateProgress(100)
}

async function runTest() {
  console.log('=== BullMQ Queue Test ===')

  // 启动临时 Worker
  const documentWorker = new Worker<DocumentJobData>(
    'document-processing',
    processDocumentJob,
    { connection: redis, concurrency }
  )
  const embeddingWorker = new Worker<EmbeddingJobData>(
    'embedding-generation',
    processEmbeddingJob,
    { connection: redis, concurrency }
  )

  // 1. 投递文档解析任务
  const jobId = await addDocumentJob('doc-test-001', 'parse')
  console.log(`Added document job: ${jobId}`)

  // 2. 查询任务状态（应处于 waiting 或 active）
  let status = await getJobStatus(jobId)
  console.log('Initial status:', status)

  // 3. 等待 Worker 处理完成（最多等待 10 秒）
  let attempts = 0
  while (attempts < 20) {
    await new Promise((r) => setTimeout(r, 500))
    status = await getJobStatus(jobId)
    if (status?.state === 'completed') {
      console.log('Final status:', status)
      break
    }
    attempts++
  }

  if (status?.state !== 'completed') {
    console.error('Job did not complete in time')
    process.exitCode = 1
  } else {
    console.log('Job completed successfully')
  }

  // 4. 清理：关闭 Worker、队列与 Redis 连接
  await documentWorker.close()
  await embeddingWorker.close()
  await documentQueue.close()
  await embeddingQueue.close()
  await redis.quit()
  console.log('=== Test finished ===')
}

runTest().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
