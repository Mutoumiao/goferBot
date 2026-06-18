import { describe, expect, it } from 'vitest'
import { IndexingWorker } from '@/processors/queue/indexing.worker.js'
import { QueueModule } from '@/processors/queue/queue.module.js'

describe('QueueModule', () => {
  it('AC-08: QueueModule registers DOCUMENT_JOB_HANDLER bound to IndexingWorker', () => {
    const module = QueueModule.forRoot()
    const providers = module.providers as any[]
    const handlerProvider = providers.find((p) => p.provide === 'DOCUMENT_JOB_HANDLER')
    expect(handlerProvider).toBeDefined()
    expect(handlerProvider.inject).toContain(IndexingWorker)
  })
})
