import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import { FakeBackendTransport } from '@goferbot/backend-adapters'
import { setBackend } from '@goferbot/backend-adapters'
import { setShell } from '@goferbot/shell-adapters'
import { MemoryShell } from '@goferbot/shell-adapters'

describe('useKnowledgeBaseStore extended', () => {
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

  it('togglePin sorts pinned items to top', async () => {
    backend.when('PATCH', '/knowledge-bases/1').respond(200, { id: '1', is_pinned: 1, sort_order: 100 })

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
    backend.when('PATCH', '/knowledge-bases/kb1/files/old.md').respond(200, { name: 'new.md' })

    const store = useKnowledgeBaseStore()
    store.selectedKbId = 'kb1'
    await store.renameFile('old.md', 'new')
    expect(backend.wasRequestCalled('PATCH', '/knowledge-bases/kb1/files/old.md')).toBe(true)
  })

  it('createFolder calls POST folders', async () => {
    backend.when('POST', '/knowledge-bases/kb1/folders').respond(200, { name: 'newfolder' })

    const store = useKnowledgeBaseStore()
    store.selectedKbId = 'kb1'
    await store.createFolder('newfolder')
    expect(backend.wasRequestCalled('POST', '/knowledge-bases/kb1/folders')).toBe(true)
  })
})
