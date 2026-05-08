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
})
