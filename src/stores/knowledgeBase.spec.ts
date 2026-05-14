import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKnowledgeBaseStore } from './knowledgeBase'
import { setShell } from '@/shell'
import { MemoryShell } from '@/shell/memory'

const sidecarFetch = vi.hoisted(() => vi.fn())

vi.mock('@/utils/sidecarClient', () => ({
  sidecarFetch,
  setSidecarPort: vi.fn(),
  getSidecarPort: vi.fn(() => 11451),
  clearSidecarPort: vi.fn(),
}))

beforeEach(() => {
  setActivePinia(createPinia())
  sidecarFetch.mockClear()
  setShell(new MemoryShell({ initialPort: 11451 }))
})

describe('initial state', () => {
  it('has correct default state', () => {
    const store = useKnowledgeBaseStore()
    expect(store.knowledgeBases).toEqual([])
    expect(store.selectedKbId).toBeNull()
    expect(store.files).toEqual([])
    expect(store.history).toEqual([{ type: 'browse', path: '' }])
    expect(store.historyIndex).toBe(0)
  })
})

describe('loadKnowledgeBases', () => {
  it('should populate the knowledge base list', async () => {
    sidecarFetch.mockResolvedValueOnce({
      json: async () => [
        { id: 'kb1', name: 'KB One', path: '/tmp/kb1', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-database' },
      ],
    } as Response)

    const store = useKnowledgeBaseStore()
    await store.loadKnowledgeBases()

    expect(store.knowledgeBases.length).toBe(1)
    expect(store.knowledgeBases[0].name).toBe('KB One')
  })

  it('should set error and isLoading on failure', async () => {
    sidecarFetch.mockRejectedValueOnce(new Error('Network error'))

    const store = useKnowledgeBaseStore()
    await store.loadKnowledgeBases()

    expect(store.error).toContain('Network error')
    expect(store.isLoading).toBe(false)
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
        is_pinned: 0,
        sort_order: 0,
        icon: 'mdi-database',
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

  it('should throw and set error on duplicate name', async () => {
    sidecarFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Knowledge base already exists' }),
    } as Response)

    const store = useKnowledgeBaseStore()
    store.knowledgeBases = [
      { id: 'kb1', name: 'Existing', path: '/tmp', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-database' },
    ]

    await expect(store.createKnowledgeBase('Existing')).rejects.toThrow('Knowledge base already exists')
    expect(store.error).toContain('already exists')
    expect(store.knowledgeBases).toHaveLength(1)
  })
})

describe('selectKb', () => {
  it('should reset navigation and load files', async () => {
    sidecarFetch.mockResolvedValueOnce({
      json: async () => [],
    } as Response)

    const store = useKnowledgeBaseStore()
    store.knowledgeBases = [
      { id: 'kb1', name: 'KB One', path: '/tmp/kb1', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-database' },
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

  it('should clear results on empty query', async () => {
    const store = useKnowledgeBaseStore()
    store.selectedKbId = 'kb1'
    store.searchResults = [{ name: 'prev.md', type: 'file' as const, size: 1, updatedAt: 1, relativePath: 'prev.md' }]

    await store.searchFiles('')

    expect(store.searchResults).toEqual([])
  })
})

describe('breadcrumb', () => {
  it('computes breadcrumb from current path', () => {
    const store = useKnowledgeBaseStore()
    store.history = [{ type: 'browse', path: 'a/b/c' }]
    store.historyIndex = 0
    expect(store.breadcrumb).toEqual(['a', 'b', 'c'])
  })

  it('returns empty breadcrumb for root path', () => {
    const store = useKnowledgeBaseStore()
    store.history = [{ type: 'browse', path: '' }]
    store.historyIndex = 0
    expect(store.breadcrumb).toEqual([])
  })

  it('returns empty breadcrumb when in search mode', () => {
    const store = useKnowledgeBaseStore()
    store.history = [{ type: 'search', query: 'q' }]
    store.historyIndex = 0
    expect(store.breadcrumb).toEqual([])
  })
})

describe('history truncation', () => {
  it('truncates forward history when navigating to new path', async () => {
    sidecarFetch.mockResolvedValue({
      json: async () => ({ items: [] }),
    } as Response)

    const store = useKnowledgeBaseStore()
    store.selectedKbId = 'kb1'

    store.navigateToPath('folderA')
    store.navigateToPath('folderA/subB')
    store.goBack()
    expect(store.historyIndex).toBe(1)

    store.navigateToPath('folderC')
    expect(store.history).toHaveLength(3)
    expect((store.history[2] as { type: string; path: string }).path).toBe('folderC')
    expect(store.canGoForward).toBe(false)
  })
})

describe('importFiles', () => {
  it('should call shell.importFiles', async () => {
    const shell = new MemoryShell({ initialPort: 11451 })
    setShell(shell)

    sidecarFetch.mockResolvedValueOnce({
      json: async () => ({ items: [] }),
    } as Response)

    const store = useKnowledgeBaseStore()
    store.selectedKbId = 'kb1'

    await store.importFiles()

    expect(shell.getImportCalls()).toContainEqual({
      knowledgeBaseId: 'kb1',
      targetPath: '',
    })
  })
})
