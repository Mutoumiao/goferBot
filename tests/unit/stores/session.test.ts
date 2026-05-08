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

describe('useSessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(sidecarFetch).mockReset()
  })

  it('has home tab by default', () => {
    const store = useSessionStore()
    expect(store.tabs).toHaveLength(1)
    expect(store.tabs[0].title).toBe('首页')
    expect(store.tabs[0].closable).toBe(false)
  })

  it('switches active tab', () => {
    const store = useSessionStore()
    store.addTab({ id: 't1', type: 'chat', title: '新会话', closable: true })
    expect(store.activeTabId).toBe('t1')
    store.switchTab('home')
    expect(store.activeTabId).toBe('home')
  })

  it('does not close home tab', () => {
    const store = useSessionStore()
    store.closeTab('home')
    expect(store.tabs).toHaveLength(1)
  })

  it('closes closable tab and switches to remaining tab', () => {
    const store = useSessionStore()
    store.addTab({ id: 't1', type: 'chat', title: '新会话', closable: true })
    store.closeTab('t1')
    expect(store.tabs).toHaveLength(1)
    expect(store.activeTabId).toBe('home')
  })

  it('promotes home tab on first message and creates new home', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      body: createMockStream('data: {"content":"你好"}\n\n'),
    } as Response)

    const store = useSessionStore()
    await store.sendMessage('你好', {
      provider: 'test',
      model: 'test',
      baseUrl: '',
      apiKey: 'key',
    })

    expect(store.tabs).toHaveLength(2)
    expect(store.tabs[0].sessionId).toBeDefined()
    expect(store.tabs[0].title).toBe('你好')
    expect(store.tabs[1].title).toBe('首页')
    expect(store.activeMessages).toHaveLength(2)
    expect(store.activeMessages[1].content).toBe('你好')
  })

  it('appends messages to existing session', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      body: createMockStream('data: {"content":"reply"}\n\n'),
    } as Response)

    const store = useSessionStore()
    store.addTab({ id: 't1', type: 'chat', title: '已有会话', closable: true, sessionId: 'sess-1' })
    store.messages.set('sess-1', [
      { id: 'm1', session_id: 'sess-1', role: 'user', content: 'prev', created_at: 1 },
    ])

    await store.sendMessage('next', {
      provider: 'test',
      model: 'test',
      baseUrl: '',
      apiKey: 'key',
    })

    expect(store.tabs).toHaveLength(2) // home + t1 (no new home for existing session)
    expect(store.messages.get('sess-1')).toHaveLength(3)
  })

  it('sets sendError on failed request', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: false,
      text: async () => 'Bad Request',
    } as Response)

    const store = useSessionStore()
    await store.sendMessage('fail', {
      provider: 'test',
      model: 'test',
      baseUrl: '',
      apiKey: 'key',
    })

    expect(store.sendError).toContain('Bad Request')
    expect(store.isSending).toBe(false)
  })

  it('sets isSending to true during message send and false after', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      body: createMockStream('data: {"content":"reply"}\n\n'),
    } as Response)

    const store = useSessionStore()
    const promise = store.sendMessage('hello', {
      provider: 'test',
      model: 'test',
      baseUrl: '',
      apiKey: 'key',
    })

    expect(store.isSending).toBe(true)
    await promise
    expect(store.isSending).toBe(false)
  })

  it('appends streaming content to assistant message chunk by chunk', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      body: createMockStream(
        'data: {"content":"Hello "}\n\ndata: {"content":"world"}\n\ndata: {"content":"!"}\n\n'
      ),
    } as Response)

    const store = useSessionStore()
    store.addTab({ id: 't1', type: 'chat', title: 'Stream', closable: true, sessionId: 'sess-1' })
    store.messages.set('sess-1', [
      { id: 'm1', session_id: 'sess-1', role: 'user', content: 'prev', created_at: 1 },
    ])

    await store.sendMessage('stream', {
      provider: 'test',
      model: 'test',
      baseUrl: '',
      apiKey: 'key',
    })

    const msgs = store.messages.get('sess-1')
    expect(msgs).toHaveLength(3)
    expect(msgs![msgs!.length - 1].content).toBe('Hello world!')
  })
})
