import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import { FakeBackendTransport } from '@goferbot/backend-adapters'
import { setBackend } from '@goferbot/backend-adapters'
import { setShell } from '@goferbot/shell-adapters'
import { MemoryShell } from '@goferbot/shell-adapters'

describe('useKnowledgeBaseStore remaining actions', () => {
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

  it('deleteKnowledgeBase removes kb from list and clears selection', async () => {
    backend.when('DELETE', '/knowledge-bases/1').respond(200, {})

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
    backend.when('POST', '/knowledge-bases/1/restore').respond(200, {
      id: '1', name: 'Restored', path: '/r', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-database',
    })

    const store = useKnowledgeBaseStore()
    await store.restoreKnowledgeBase('1')
    expect(store.knowledgeBases[0].name).toBe('Restored')
  })

  it('loadDeletedKnowledgeBases populates deleted list', async () => {
    backend.when('GET', '/knowledge-bases/deleted').respond(200, [
      { id: '1', name: 'Deleted', path: '/d', created_at: 1, deleted_at: 1, is_pinned: 0, sort_order: 0, icon: 'mdi-database' },
    ])

    const store = useKnowledgeBaseStore()
    await store.loadDeletedKnowledgeBases()
    expect(store.deletedKnowledgeBases).toHaveLength(1)
    expect(store.deletedKnowledgeBases[0].name).toBe('Deleted')
  })

  it('moveFile calls POST /move and refreshes files', async () => {
    backend.when('POST', '/knowledge-bases/move').respond(200, {})

    const store = useKnowledgeBaseStore()
    store.selectedKbId = 'kb1'
    store.history = [{ type: 'browse', path: '' }]
    store.historyIndex = 0

    await store.moveFile('kb1', 'file.md', 'kb2', '')
    expect(backend.wasRequestCalled('POST', '/knowledge-bases/move')).toBe(true)
  })

  it('copyFile calls POST /copy and refreshes files if target is selected', async () => {
    backend.when('POST', '/knowledge-bases/copy').respond(200, {})

    const store = useKnowledgeBaseStore()
    store.selectedKbId = 'kb2'
    store.history = [{ type: 'browse', path: '' }]
    store.historyIndex = 0

    await store.copyFile('kb1', 'file.md', 'kb2', '')
    expect(backend.wasRequestCalled('POST', '/knowledge-bases/copy')).toBe(true)
  })

  it('renameKnowledgeBase updates local list', async () => {
    backend.when('PATCH', '/knowledge-bases/1').respond(200, {
      id: '1', name: 'Renamed', path: '/r', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-database',
    })

    const store = useKnowledgeBaseStore()
    store.knowledgeBases = [
      { id: '1', name: 'Old', path: '/o', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-database' },
    ]
    await store.renameKnowledgeBase('1', 'Renamed')
    expect(store.knowledgeBases[0].name).toBe('Renamed')
  })

  it('updateKbIcon updates local list', async () => {
    backend.when('PATCH', '/knowledge-bases/1').respond(200, {
      id: '1', name: 'KB', path: '/k', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-books',
    })

    const store = useKnowledgeBaseStore()
    store.knowledgeBases = [
      { id: '1', name: 'KB', path: '/k', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-database' },
    ]
    await store.updateKbIcon('1', 'mdi-books')
    expect(store.knowledgeBases[0].icon).toBe('mdi-books')
  })

  it('deleteFile calls DELETE and refreshes files', async () => {
    backend.when('DELETE', '/knowledge-bases/kb1/files/old.md').respond(200, {})

    const store = useKnowledgeBaseStore()
    store.selectedKbId = 'kb1'
    store.history = [{ type: 'browse', path: '' }]
    store.historyIndex = 0

    await store.deleteFile('old.md')
    expect(backend.wasRequestCalled('DELETE', '/knowledge-bases/kb1/files/old.md')).toBe(true)
  })
})
