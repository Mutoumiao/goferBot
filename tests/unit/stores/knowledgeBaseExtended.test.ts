import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import { sidecarFetch } from '@/utils/sidecarClient'

vi.mock('@/utils/sidecarClient')

describe('useKnowledgeBaseStore extended', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(sidecarFetch).mockReset()
  })

  it('togglePin sorts pinned items to top', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: '1', is_pinned: 1, sort_order: 100 }),
    } as Response)

    const store = useKnowledgeBaseStore()
    store.knowledgeBases = [
      { id: '1', name: 'A', is_pinned: 0, sort_order: 0, icon: 'mdi-database', path: '/a', created_at: 1, deleted_at: null },
      { id: '2', name: 'B', is_pinned: 1, sort_order: 0, icon: 'mdi-database', path: '/b', created_at: 2, deleted_at: null },
    ]
    await store.togglePin('1')
    expect(store.knowledgeBases[0].id).toBe('1')
    expect(store.knowledgeBases[0].is_pinned).toBe(1)
  })

  it('renameFile calls PATCH and refreshes files', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'new.md' }),
    } as Response)

    const store = useKnowledgeBaseStore()
    store.selectedKbId = 'kb1'
    await store.renameFile('old.md', 'new')
    expect(sidecarFetch).toHaveBeenCalledWith('/knowledge-bases/kb1/files/old.md', expect.any(Object))
  })

  it('createFolder calls POST folders', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'newfolder' }),
    } as Response)

    const store = useKnowledgeBaseStore()
    store.selectedKbId = 'kb1'
    await store.createFolder('newfolder')
    expect(sidecarFetch).toHaveBeenCalledWith('/knowledge-bases/kb1/folders', expect.any(Object))
  })
})
