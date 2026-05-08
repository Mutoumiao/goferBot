import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import KnowledgeBasePage from '@/components/KnowledgeBasePage.vue'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'

function mountPage(storeOverrides?: Record<string, unknown>) {
  const pinia = createTestingPinia({
    stubActions: false,
    initialState: {
      knowledgeBase: {
        knowledgeBases: [],
        selectedKbId: null,
        isLoading: false,
        error: null,
        files: [],
        searchResults: [],
        searchQuery: '',
        breadcrumb: [],
        history: [{ type: 'browse', path: '' }],
        historyIndex: 0,
        deletedKnowledgeBases: [],
        ...storeOverrides,
      },
    },
  })
  setActivePinia(pinia)

  return mount(KnowledgeBasePage, {
    global: {
      plugins: [pinia],
      stubs: {
        FileExplorer: true,
        RecycleBinPage: true,
        ContextMenu: true,
        EditKbDialog: true,
        MoveCopyDialog: true,
      },
    },
  })
}

describe('KnowledgeBasePage', () => {
  it('shows placeholder when no knowledge base is selected', () => {
    const wrapper = mountPage()
    expect(wrapper.text()).toContain('选择一个知识库或创建新库')
  })

  it('shows FileExplorer when a knowledge base is selected', () => {
    const wrapper = mountPage({
      knowledgeBases: [{ id: 'kb1', name: 'Test', path: '/tmp', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-database' }],
      selectedKbId: 'kb1',
    })
    expect(wrapper.findComponent({ name: 'FileExplorer' }).exists()).toBe(true)
  })

  it('shows RecycleBinPage when recycle bin is toggled', async () => {
    const wrapper = mountPage()
    const recycleBtn = wrapper.findAll('button').find((b) => b.text().includes('回收站'))
    await recycleBtn!.trigger('click')
    expect(wrapper.findComponent({ name: 'RecycleBinPage' }).exists()).toBe(true)
  })

  it('calls loadKnowledgeBases on mount', () => {
    mountPage()
    const store = useKnowledgeBaseStore()
    expect(store.loadKnowledgeBases).toHaveBeenCalled()
  })

  it('renders knowledge base list in sidebar', () => {
    const wrapper = mountPage({
      knowledgeBases: [
        { id: 'kb1', name: 'Alpha', path: '/a', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-database' },
        { id: 'kb2', name: 'Beta', path: '/b', created_at: 2, deleted_at: null, is_pinned: 1, sort_order: 0, icon: 'mdi-books' },
      ],
    })
    expect(wrapper.text()).toContain('Alpha')
    expect(wrapper.text()).toContain('Beta')
  })
})
