import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from '@/stores/session'
import { FakeBackendTransport } from '@/backend/fake-transport'
import { setBackend } from '@/backend'
import { setShell } from '@/shell'
import { MemoryShell } from '@/shell/memory'

describe('useSessionStore', () => {
  let backend: FakeBackendTransport

  beforeEach(() => {
    setActivePinia(createPinia())
    setShell(new MemoryShell({ initialPort: 11451 }))
    backend = new FakeBackendTransport()
    setBackend(backend)
  })

  afterEach(() => {
    setBackend(null)
    setShell(null)
  })

  it('has home tab by default', () => {
    const store = useSessionStore()
    expect(store.tabs).toHaveLength(1)
    expect(store.tabs[0].title).toBe('首页')
    expect(store.tabs[0].closable).toBe(true)
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
    backend.when('POST', '/chat').respondSSE([
      { data: '{"content":"你好"}', event: '' },
    ])

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

  it('promotes home tab with provider and model on first message', async () => {
    backend.when('POST', '/chat').respondSSE([
      { data: '{"content":"你好"}', event: '' },
    ])

    const store = useSessionStore()
    await store.sendMessage('你好', {
      provider: 'openai',
      model: 'gpt-4',
      baseUrl: '',
      apiKey: 'key',
    })

    expect(store.tabs[0].provider).toBe('openai')
    expect(store.tabs[0].model).toBe('gpt-4')
  })

  it('appends messages to existing session', async () => {
    backend.when('POST', '/chat').respondSSE([
      { data: '{"content":"reply"}', event: '' },
    ])

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

  it('sets sendError on SSE error event', async () => {
    backend.when('POST', '/chat').respondSSE([
      { data: '{"type":"api_error","message":"Bad Request"}', event: 'error' },
    ])

    const store = useSessionStore()
    await store.sendMessage('fail', {
      provider: 'test',
      model: 'test',
      baseUrl: '',
      apiKey: 'key',
    })

    expect(store.sendError).toContain('Bad Request')
    expect(store.sendErrorType).toBe('api_error')
    expect(store.isSending).toBe(false)
  })

  it('sets isSending to true during message send and false after', async () => {
    backend.when('POST', '/chat').respondSSE([
      { data: '{"content":"reply"}', event: '' },
    ])

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
    backend.when('POST', '/chat').respondSSE([
      { data: '{"content":"Hello "}', event: '' },
      { data: '{"content":"world"}', event: '' },
      { data: '{"content":"!"}', event: '' },
    ])

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
