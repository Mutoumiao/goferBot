import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from '@/stores/session'
import { FakeBackendTransport } from '@/backend/fake-transport'
import { setBackend } from '@/backend'
import { setShell } from '@/shell'
import { MemoryShell } from '@/shell/memory'

describe('session store history methods', () => {
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

  it('loadHistory fetches sessions from API', async () => {
    backend.when('GET', '/sessions').respond(200, [
      { id: 's1', title: 'Hello', updated_at: 1, summary: 'summary', message_count: 2 },
    ])

    const store = useSessionStore()
    await store.loadHistory()

    expect(store.historySessions).toHaveLength(1)
    expect(store.historySessions[0].title).toBe('Hello')
    expect(store.historyLoading).toBe(false)
  })

  it('loadHistory sets error on failure', async () => {
    backend.when('GET', '/sessions').respond(500, { error: 'fail' })

    const store = useSessionStore()
    await store.loadHistory()

    expect(store.historyError).toBe('加载历史记录失败')
    expect(store.historyLoading).toBe(false)
  })

  it('restoreSession activates existing tab if already open', async () => {
    const store = useSessionStore()
    store.addTab({ id: 't1', type: 'chat', title: 'Existing', closable: true, sessionId: 's1' })
    store.addTab({ id: 'home', type: 'chat', title: '首页', closable: true })
    store.switchTab('home')

    await store.restoreSession('s1')
    expect(store.activeTabId).toBe('t1')
    expect(backend.wasRequestCalled('GET', '/sessions/s1')).toBe(false)
  })

  it('restoreSession reuses home tab when empty', async () => {
    backend.when('GET', '/sessions/s1').respond(200, {
      id: 's1',
      title: 'Restored',
      provider: 'openai',
      model: 'gpt-4o',
      messages: [{ id: 'm1', session_id: 's1', role: 'user', content: 'hi', created_at: 1 }],
    })

    const store = useSessionStore()
    // home tab exists by default
    await store.restoreSession('s1')

    const homeTab = store.tabs.find((t) => t.id === 'home')
    expect(homeTab?.sessionId).toBe('s1')
    expect(homeTab?.title).toBe('Restored')
    expect(homeTab?.provider).toBe('openai')
    expect(homeTab?.model).toBe('gpt-4o')
    expect(store.messages.get('s1')).toHaveLength(1)
  })

  it('restoreSession creates new tab when no home tab available', async () => {
    backend.when('GET', '/sessions/s1').respond(200, {
      id: 's1',
      title: 'Restored',
      provider: 'openai',
      model: 'gpt-4o',
      messages: [],
    })

    const store = useSessionStore()
    store.tabs[0].sessionId = 'existing'
    await store.restoreSession('s1')

    expect(store.tabs).toHaveLength(2)
    expect(store.tabs[1].sessionId).toBe('s1')
    expect(store.tabs[1].provider).toBe('openai')
    expect(store.tabs[1].model).toBe('gpt-4o')
  })

  it('deleteSession closes tab, clears messages and refreshes history', async () => {
    backend
      .when('DELETE', '/sessions/s1').respond(200, {})
      .when('GET', '/sessions').respond(200, [])

    const store = useSessionStore()
    store.addTab({ id: 't1', type: 'chat', title: 'ToDelete', closable: true, sessionId: 's1' })
    store.messages.set('s1', [{ id: 'm1', session_id: 's1', role: 'user', content: 'hi', created_at: 1 }])
    store.historySessions = [{ id: 's1', title: 'ToDelete', updated_at: 1, summary: '', message_count: 1 }]

    await store.deleteSession('s1')

    expect(store.tabs.find((t) => t.sessionId === 's1')).toBeUndefined()
    expect(store.messages.has('s1')).toBe(false)
    expect(backend.wasRequestCalled('DELETE', '/sessions/s1')).toBe(true)
  })

  it('renameSession updates tab title and history entry', async () => {
    backend.when('POST', '/sessions/s1/rename').respond(200, {})

    const store = useSessionStore()
    store.addTab({ id: 't1', type: 'chat', title: 'Old', closable: true, sessionId: 's1' })
    store.historySessions = [{ id: 's1', title: 'Old', updated_at: 1, summary: '', message_count: 1 }]

    await store.renameSession('s1', 'New Title')

    const tab = store.tabs.find((t) => t.sessionId === 's1')
    expect(tab?.title).toBe('New Title')
    expect(store.historySessions[0].title).toBe('New Title')
    expect(backend.wasRequestCalled('POST', '/sessions/s1/rename')).toBe(true)
    const req = backend.getRequestHistory().find((r) => r.method === 'POST' && r.path === '/sessions/s1/rename')
    expect(req).toBeDefined()
    expect(req!.body).toEqual({ title: 'New Title' })
  })
})
