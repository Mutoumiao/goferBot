import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from '@/stores/session'
import { sidecarFetch } from '@/utils/sidecarClient'

vi.mock('@/utils/sidecarClient')

function createMockStream(text: string): ReadableStream {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(text))
      controller.close()
    },
  })
}

describe('useSessionStore sendMessage with knowledgeBaseIds', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(sidecarFetch).mockReset()
  })

  it('sends knowledgeBaseIds in request body', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      body: createMockStream('data: {"content":"reply"}\n\n'),
    } as Response)

    const store = useSessionStore()
    await store.sendMessage('hello rag', {
      provider: 'test',
      model: 'test',
      baseUrl: '',
      apiKey: 'key',
    }, ['kb1', 'kb2'])

    expect(sidecarFetch).toHaveBeenCalledWith(
      '/chat',
      expect.objectContaining({
        body: expect.stringContaining('"knowledgeBaseIds":["kb1","kb2"]'),
      })
    )
  })

  it('omits knowledgeBaseIds from body when not provided', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      body: createMockStream('data: {"content":"reply"}\n\n'),
    } as Response)

    const store = useSessionStore()
    await store.sendMessage('hello no rag', {
      provider: 'test',
      model: 'test',
      baseUrl: '',
      apiKey: 'key',
    })

    const callArg = vi.mocked(sidecarFetch).mock.calls[0][1] as { body: string }
    const bodyObj = JSON.parse(callArg.body)
    expect(bodyObj).not.toHaveProperty('knowledgeBaseIds')
  })

  it('optimistically adds user message with knowledge_base_ids', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      body: createMockStream('data: {"content":"reply"}\n\n'),
    } as Response)

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
