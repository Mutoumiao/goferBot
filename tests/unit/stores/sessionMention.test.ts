import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from '@/stores/session'
import { FakeBackendTransport } from '@goferbot/backend-adapters'
import { setBackend } from '@goferbot/backend-adapters'
import { setShell } from '@goferbot/shell-adapters'
import { MemoryShell } from '@goferbot/shell-adapters'

describe('useSessionStore sendMessage with knowledgeBaseIds', () => {
  let backend: FakeBackendTransport

  beforeEach(() => {
    setActivePinia(createPinia())
    backend = new FakeBackendTransport()
    setBackend(backend)
    setShell(new MemoryShell({ initialPort: 11451 }))
  })

  afterEach(() => {
    setBackend(null)
    setShell(null)
  })

  it('sends knowledgeBaseIds in request body', async () => {
    backend.when('POST', '/chat').respondSSE([{ data: '{"content":"reply"}' }])

    const store = useSessionStore()
    await store.sendMessage('hello rag', {
      provider: 'test',
      model: 'test',
      baseUrl: '',
      apiKey: 'key',
    }, ['kb1', 'kb2'])

    expect(backend.wasRequestCalled('POST', '/chat')).toBe(true)
    const req = backend.getRequestHistory().find((r) => r.method === 'POST' && r.path === '/chat')
    expect(req).toBeDefined()
    expect(JSON.stringify(req!.body)).toContain('"knowledgeBaseIds":["kb1","kb2"]')
  })

  it('omits knowledgeBaseIds from body when not provided', async () => {
    backend.when('POST', '/chat').respondSSE([{ data: '{"content":"reply"}' }])

    const store = useSessionStore()
    await store.sendMessage('hello no rag', {
      provider: 'test',
      model: 'test',
      baseUrl: '',
      apiKey: 'key',
    })

    const req = backend.getRequestHistory().find((r) => r.method === 'POST' && r.path === '/chat')
    expect(req).toBeDefined()
    const bodyObj = req!.body as any
    expect(bodyObj).not.toHaveProperty('knowledgeBaseIds')
  })

  it('optimistically adds user message with knowledge_base_ids', async () => {
    backend.when('POST', '/chat').respondSSE([{ data: '{"content":"reply"}' }])

    const store = useSessionStore()
    await store.sendMessage('hello rag', {
      provider: 'test',
      model: 'test',
      baseUrl: '',
      apiKey: 'key',
    }, ['kb1'])

    const sessionId = store.activeTab?.sessionId
    expect(sessionId).toBeDefined()
    const msgs = store.messages.get(sessionId!)
    expect(msgs).toBeDefined()
    expect(msgs![0].knowledge_base_ids).toBe('["kb1"]')
  })
})
