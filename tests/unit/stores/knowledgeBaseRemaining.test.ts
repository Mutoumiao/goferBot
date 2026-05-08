import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import { sidecarFetch } from '@/utils/sidecarClient'

vi.mock('@/utils/sidecarClient')

describe('useKnowledgeBaseStore remaining actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(sidecarFetch).mockReset()
  })

  it('deleteKnowledgeBase removes kb from list and clears selection', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response)

    const store = useKnowledgeBaseStore()
    store.knowledgeBases = [
      { id: '1', name: 'A', path: '/a', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-database' },
    ]
    store.selectedKbId = '1'
    store.files = [{ name: 'f.md', type: 'file', size: 1, updatedAt: 1 }]

    await store.deleteKnowledgeBase('1')
    expect(store.knowledgeBases).toHaveLength(0)
    expect(store.selectedKbId).toBeNull()
    expect(store.files).toHaveLength(0)
  })

  it('restoreKnowledgeBase adds kb back to list', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: '1', name: 'Restored', path: '/r', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-database' }),
    } as Response)

    const store = useKnowledgeBaseStore()
    await store.restoreKnowledgeBase('1')
    expect(store.knowledgeBases[0].name).toBe('Restored')
  })

  it('loadDeletedKnowledgeBases populates deleted list', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => [{ id: '1', name: 'Deleted', path: '/d', created_at: 1, deleted_at: 1, is_pinned: 0, sort_order: 0, icon: 'mdi-database' }],
    } as Response)

    const store = useKnowledgeBaseStore()
    await store.loadDeletedKnowledgeBases()
    expect(store.deletedKnowledgeBases).toHaveLength(1)
    expect(store.deletedKnowledgeBases[0].name).toBe('Deleted')
  })

  it('moveFile calls POST /move and refreshes files', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response)

    const store = useKnowledgeBaseStore()
    store.selectedKbId = 'kb1'
    store.history = [{ type: 'browse', path: '' }]
    store.historyIndex = 0

    await store.moveFile('kb1', 'file.md', 'kb2', '')
    expect(sidecarFetch).toHaveBeenCalledWith('/move', expect.any(Object))
  })

  it('copyFile calls POST /copy and refreshes files if target is selected', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response)

    const store = useKnowledgeBaseStore()
    store.selectedKbId = 'kb2'
    store.history = [{ type: 'browse', path: '' }]
    store.historyIndex = 0

    await store.copyFile('kb1', 'file.md', 'kb2', '')
    expect(sidecarFetch).toHaveBeenCalledWith('/copy', expect.any(Object))
  })

  it('renameKnowledgeBase updates local list', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: '1', name: 'Renamed', path: '/r', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-database' }),
    } as Response)

    const store = useKnowledgeBaseStore()
    store.knowledgeBases = [
      { id: '1', name: 'Old', path: '/o', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-database' },
    ]
    await store.renameKnowledgeBase('1', 'Renamed')
    expect(store.knowledgeBases[0].name).toBe('Renamed')
  })

  it('updateKbIcon updates local list', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: '1', name: 'KB', path: '/k', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-books' }),
    } as Response)

    const store = useKnowledgeBaseStore()
    store.knowledgeBases = [
      { id: '1', name: 'KB', path: '/k', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-database' },
    ]
    await store.updateKbIcon('1', 'mdi-books')
    expect(store.knowledgeBases[0].icon).toBe('mdi-books')
  })

  it('deleteFile calls DELETE and refreshes files', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response)

    const store = useKnowledgeBaseStore()
    store.selectedKbId = 'kb1'
    store.history = [{ type: 'browse', path: '' }]
    store.historyIndex = 0

    await store.deleteFile('old.md')
    expect(sidecarFetch).toHaveBeenCalledWith('/knowledge-bases/kb1/files/old.md', { method: 'DELETE' })
  })
})
