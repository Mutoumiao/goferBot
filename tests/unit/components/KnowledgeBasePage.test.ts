import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import KnowledgeBasePage from '@/components/KnowledgeBasePage.vue'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'

function mountPage(storeOverrides?: Record<string, unknown>) {
  const pinia = createTestingPinia({
    stubActions: true,
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
  it('renders FileExplorer when no knowledge base is selected', () => {
    const wrapper = mountPage()
    expect(wrapper.findComponent({ name: 'FileExplorer' }).exists()).toBe(true)
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
    const selected = wrapper.find('[data-testid="kb-item"]')
    expect(selected.exists()).toBe(true)
    expect(selected.text()).toContain('Alpha')
    expect(selected.classes()).toContain('bg-white')
  })

  it('shows empty list when no knowledge bases', () => {
    const wrapper = mountPage({ knowledgeBases: [], isLoading: false })
    expect(wrapper.find('[data-testid="kb-list"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="kb-item"]').length).toBe(0)
  })

  it('opens new knowledge base dialog on plus click', async () => {
    const wrapper = mountPage()
    const plusBtn = wrapper.findAll('button').find((b) => b.find('svg.lucide-plus').exists())
    await plusBtn!.trigger('click')
    expect(wrapper.text()).toContain('新建知识库')
  })

  it('shows validation error for empty kb name', async () => {
    const wrapper = mountPage()
    const plusBtn = wrapper.findAll('button').find((b) => b.find('svg.lucide-plus').exists())
    await plusBtn!.trigger('click')

    const createBtn = wrapper.findAll('button').find((b) => b.text() === '创建')
    await createBtn!.trigger('click')

    expect(wrapper.text()).toContain('请输入知识库名称')
  })

  it('closes dialog and creates kb on valid name', async () => {
    const wrapper = mountPage()
    const store = useKnowledgeBaseStore()

    const plusBtn = wrapper.findAll('button').find((b) => b.find('svg.lucide-plus').exists())
    await plusBtn!.trigger('click')

    const input = wrapper.find('input[placeholder="输入知识库名称"]')
    await input.setValue('My KB')

    const createBtn = wrapper.findAll('button').find((b) => b.text() === '创建')
    await createBtn!.trigger('click')
    await flushPromises()

    expect(store.createKnowledgeBase).toHaveBeenCalledWith('My KB')
  })

  it('displays dialog error when creation fails', async () => {
    const wrapper = mountPage()
    const store = useKnowledgeBaseStore()
    store.error = 'Something broke'
    store.createKnowledgeBase = vi.fn().mockRejectedValue(new Error('fail'))

    const plusBtn = wrapper.findAll('button').find((b) => b.find('svg.lucide-plus').exists())
    await plusBtn!.trigger('click')

    const input = wrapper.find('input[placeholder="输入知识库名称"]')
    await input.setValue('My KB')

    const createBtn = wrapper.findAll('button').find((b) => b.text() === '创建')
    await createBtn!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Something broke')
  })

  it('clears dialog error when closing and re-opening', async () => {
    const wrapper = mountPage()
    const store = useKnowledgeBaseStore()
    store.error = 'Oops'
    store.createKnowledgeBase = vi.fn().mockRejectedValue(new Error('fail'))

    const plusBtn = wrapper.findAll('button').find((b) => b.find('svg.lucide-plus').exists())
    await plusBtn!.trigger('click')

    const input = wrapper.find('input[placeholder="输入知识库名称"]')
    await input.setValue('My KB')

    const createBtn = wrapper.findAll('button').find((b) => b.text() === '创建')
    await createBtn!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Oops')

    // Close dialog
    const cancelBtn = wrapper.findAll('button').find((b) => b.text() === '取消')
    await cancelBtn!.trigger('click')
    await flushPromises()

    // Re-open dialog
    await plusBtn!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('Oops')
  })
})
