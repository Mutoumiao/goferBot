import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKnowledgeBaseStore } from './knowledgeBase'

const sidecarFetch = vi.hoisted(() => vi.fn())
const invoke = vi.hoisted(() => vi.fn())

vi.mock('@/utils/sidecarClient', () => ({
  sidecarFetch,
  setSidecarPort: vi.fn(),
  getSidecarPort: vi.fn(() => 11451),
  clearSidecarPort: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke,
}))

beforeEach(() => {
  setActivePinia(createPinia())
  sidecarFetch.mockClear()
  invoke.mockClear()
})

describe('loadKnowledgeBases', () => {
  it('should populate the knowledge base list', async () => {
    sidecarFetch.mockResolvedValueOnce({
      json: async () => [
        { id: 'kb1', name: 'KB One', path: '/tmp/kb1', created_at: 1, deleted_at: null },
      ],
    } as Response)

    const store = useKnowledgeBaseStore()
    await store.loadKnowledgeBases()

    expect(store.knowledgeBases.length).toBe(1)
    expect(store.knowledgeBases[0].name).toBe('KB One')
  })
})

describe('createKnowledgeBase', () => {
  it('should create a knowledge base and select it', async () => {
    sidecarFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'new-kb',
        name: 'New KB',
        path: '/tmp/new-kb',
        created_at: Date.now(),
        deleted_at: null,
      }),
    } as Response)

    sidecarFetch.mockResolvedValueOnce({
      json: async () => [],
    } as Response)

    const store = useKnowledgeBaseStore()
    await store.createKnowledgeBase('New KB')

    expect(store.knowledgeBases.length).toBe(1)
    expect(store.selectedKbId).toBe('new-kb')
  })
})

describe('selectKb', () => {
  it('should reset navigation and load files', async () => {
    sidecarFetch.mockResolvedValueOnce({
      json: async () => [],
    } as Response)

    const store = useKnowledgeBaseStore()
    store.knowledgeBases = [
      { id: 'kb1', name: 'KB One', path: '/tmp/kb1', created_at: 1, deleted_at: null },
    ]

    await store.selectKb('kb1')

    expect(store.selectedKbId).toBe('kb1')
    expect(store.history.length).toBe(1)
    expect(store.historyIndex).toBe(0)
  })
})

describe('navigation', () => {
  it('should push history entries on navigate', async () => {
    sidecarFetch.mockResolvedValue({
      json: async () => ({ items: [] }),
    } as Response)

    const store = useKnowledgeBaseStore()
    store.selectedKbId = 'kb1'

    store.navigateToPath('folderA')
    expect(store.history.length).toBe(2)
    expect(store.historyIndex).toBe(1)
    expect(store.currentPath).toBe('folderA')
  })

  it('should go back and forward through history', async () => {
    sidecarFetch.mockResolvedValue({
      json: async () => ({ items: [] }),
    } as Response)

    const store = useKnowledgeBaseStore()
    store.selectedKbId = 'kb1'

    store.navigateToPath('folderA')
    store.navigateToPath('folderA/subB')

    expect(store.canGoBack).toBe(true)
    expect(store.canGoForward).toBe(false)

    store.goBack()
    expect(store.historyIndex).toBe(1)
    expect(store.currentPath).toBe('folderA')

    store.goForward()
    expect(store.historyIndex).toBe(2)
    expect(store.currentPath).toBe('folderA/subB')
  })
})

describe('searchFiles', () => {
  it('should search and push search state to history', async () => {
    sidecarFetch.mockResolvedValueOnce({
      json: async () => ({
        results: [
          { name: 'match.md', type: 'file' as const, size: 10, updatedAt: 1, relativePath: 'match.md' },
        ],
      }),
    } as Response)

    const store = useKnowledgeBaseStore()
    store.selectedKbId = 'kb1'

    await store.searchFiles('match')

    expect(store.searchResults.length).toBe(1)
    expect(store.searchQuery).toBe('match')
    expect(store.history[store.historyIndex].type).toBe('search')
  })
})

describe('importFiles', () => {
  it('should invoke the Rust IPC command', async () => {
    invoke.mockResolvedValueOnce(1)

    sidecarFetch.mockResolvedValueOnce({
      json: async () => ({ items: [] }),
    } as Response)

    const store = useKnowledgeBaseStore()
    store.selectedKbId = 'kb1'

    await store.importFiles()

    expect(invoke).toHaveBeenCalledWith('import_files', {
      knowledgeBaseId: 'kb1',
      targetPath: '',
    })
  })
})
