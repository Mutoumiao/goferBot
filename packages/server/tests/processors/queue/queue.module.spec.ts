import { describe, expect, it } from 'vitest'
import { ChatModule } from '@/modules/chat/chat.module.js'
import { ChatFinalizeProcessor } from '@/processors/chat/chat-finalize.processor.js'
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

  it('AC-CHAT-FINALIZE-DI: QueueModule.forRoot imports ChatModule so that ChatFinalizeProcessor can resolve its ChatModule-provided dependencies', () => {
    const module = QueueModule.forRoot()
    const imports = module.imports ?? []

    const hasChatModule = imports.some((i: any) => {
      if (typeof i === 'function') return i === ChatModule
      const factory = i?.forwardRef
      if (typeof factory === 'function') return factory() === ChatModule
      return false
    })
    expect(hasChatModule).toBe(true)

    const providers = module.providers as any[]
    expect(providers).toContain(ChatFinalizeProcessor)
  })
})
