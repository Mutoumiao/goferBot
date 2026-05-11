import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from '@/stores/session'
import { sidecarFetch } from '@/utils/sidecarClient'

vi.mock('@/utils/sidecarClient')

describe('session store history methods', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(sidecarFetch).mockReset()
  })

  it('loadHistory fetches sessions from API', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 's1', title: 'Hello', updated_at: 1, summary: 'summary', message_count: 2 },
      ],
    } as Response)

    const store = useSessionStore()
    await store.loadHistory()

    expect(store.historySessions).toHaveLength(1)
    expect(store.historySessions[0].title).toBe('Hello')
    expect(store.historyLoading).toBe(false)
  })

  it('loadHistory sets error on failure', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({ ok: false } as Response)

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
    expect(sidecarFetch).not.toHaveBeenCalled()
  })

  it('restoreSession reuses home tab when empty', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 's1',
        title: 'Restored',
        provider: 'openai',
        model: 'gpt-4o',
        messages: [{ id: 'm1', session_id: 's1', role: 'user', content: 'hi', created_at: 1 }],
      }),
    } as Response)

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
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 's1',
        title: 'Restored',
        provider: 'openai',
        model: 'gpt-4o',
        messages: [],
      }),
    } as Response)

    const store = useSessionStore()
    store.tabs[0].sessionId = 'existing'
    await store.restoreSession('s1')

    expect(store.tabs).toHaveLength(2)
    expect(store.tabs[1].sessionId).toBe('s1')
    expect(store.tabs[1].provider).toBe('openai')
    expect(store.tabs[1].model).toBe('gpt-4o')
  })

  it('deleteSession closes tab, clears messages and refreshes history', async () => {
    vi.mocked(sidecarFetch)
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)

    const store = useSessionStore()
    store.addTab({ id: 't1', type: 'chat', title: 'ToDelete', closable: true, sessionId: 's1' })
    store.messages.set('s1', [{ id: 'm1', session_id: 's1', role: 'user', content: 'hi', created_at: 1 }])
    store.historySessions = [{ id: 's1', title: 'ToDelete', updated_at: 1, summary: '', message_count: 1 }]

    await store.deleteSession('s1')

    expect(store.tabs.find((t) => t.sessionId === 's1')).toBeUndefined()
    expect(store.messages.has('s1')).toBe(false)
    expect(sidecarFetch).toHaveBeenCalledWith('/sessions/s1', { method: 'DELETE' })
  })

  it('renameSession updates tab title and history entry', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({ ok: true } as Response)

    const store = useSessionStore()
    store.addTab({ id: 't1', type: 'chat', title: 'Old', closable: true, sessionId: 's1' })
    store.historySessions = [{ id: 's1', title: 'Old', updated_at: 1, summary: '', message_count: 1 }]

    await store.renameSession('s1', 'New Title')

    const tab = store.tabs.find((t) => t.sessionId === 's1')
    expect(tab?.title).toBe('New Title')
    expect(store.historySessions[0].title).toBe('New Title')
    expect(sidecarFetch).toHaveBeenCalledWith(
      '/sessions/s1/rename',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'New Title' }),
      })
    )
  })
})
