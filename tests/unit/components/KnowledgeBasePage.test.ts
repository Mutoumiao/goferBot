import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
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
        ContextMenu: true,
        EditKbDialog: true,
        MoveCopyDialog: true,
        Teleport: { template: '<div><slot /></div>' },
        Transition: { template: '<div><slot /></div>' },
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

  it('highlights selected knowledge base', () => {
    const wrapper = mountPage({
      knowledgeBases: [
        { id: 'kb1', name: 'Alpha', path: '/a', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-database' },
      ],
      selectedKbId: 'kb1',
    })
    const selected = wrapper.find('.bg-accent-600\\/15')
    expect(selected.exists()).toBe(true)
    expect(selected.text()).toContain('Alpha')
  })

  it('shows empty list hint when no knowledge bases', () => {
    const wrapper = mountPage({ knowledgeBases: [], isLoading: false })
    expect(wrapper.text()).toContain('暂无知识库，点击 + 创建')
  })

  it('opens new knowledge base dialog on plus click', async () => {
    const wrapper = mountPage()
    const plusBtn = wrapper.findAll('button').find((b) => b.find('.i-mdi-plus').exists())
    await plusBtn!.trigger('click')
    expect(wrapper.text()).toContain('新建知识库')
  })

  it('shows validation error for empty kb name', async () => {
    const wrapper = mountPage()
    const plusBtn = wrapper.findAll('button').find((b) => b.find('.i-mdi-plus').exists())
    await plusBtn!.trigger('click')

    const createBtn = wrapper.findAll('button').find((b) => b.text() === '创建')
    await createBtn!.trigger('click')

    expect(wrapper.text()).toContain('请输入知识库名称')
  })

  it('closes dialog and creates kb on valid name', async () => {
    const wrapper = mountPage()
    const store = useKnowledgeBaseStore()

    const plusBtn = wrapper.findAll('button').find((b) => b.find('.i-mdi-plus').exists())
    await plusBtn!.trigger('click')

    const input = wrapper.find('input[type="text"]')
    await input.setValue('My KB')

    const createBtn = wrapper.findAll('button').find((b) => b.text() === '创建')
    await createBtn!.trigger('click')

    expect(store.createKnowledgeBase).toHaveBeenCalledWith('My KB')
  })

  it('displays error toast when store has error', async () => {
    const wrapper = mountPage()
    const store = useKnowledgeBaseStore()
    await flushPromises()
    store.error = 'Something broke'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Something broke')
  })

  it('clears error when clicking close on toast', async () => {
    const wrapper = mountPage()
    const store = useKnowledgeBaseStore()
    await flushPromises()
    store.error = 'Oops'
    await wrapper.vm.$nextTick()
    const closeBtn = wrapper.findAll('button').find((b) => b.find('.i-mdi-close').exists())
    await closeBtn!.trigger('click')
    expect(store.error).toBeNull()
  })
})
