import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import RecycleBinPage from '@/components/RecycleBinPage.vue'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'

function mountPage(storeOverrides?: Record<string, unknown>) {
  const pinia = createTestingPinia({
    stubActions: false,
    initialState: {
      knowledgeBase: {
        deletedKnowledgeBases: [],
        isLoading: false,
        ...storeOverrides,
      },
    },
  })
  setActivePinia(pinia)

  return mount(RecycleBinPage, {
    global: { plugins: [pinia] },
  })
}

describe('RecycleBinPage', () => {
  it('calls loadDeletedKnowledgeBases on mount', () => {
    mountPage()
    const store = useKnowledgeBaseStore()
    expect(store.loadDeletedKnowledgeBases).toHaveBeenCalled()
  })

  it('shows loading spinner', () => {
    const wrapper = mountPage({ isLoading: true })
    expect(wrapper.find('.i-mdi-loading').exists()).toBe(true)
  })

  it('shows empty state when no deleted knowledge bases', () => {
    const wrapper = mountPage({ deletedKnowledgeBases: [] })
    expect(wrapper.text()).toContain('回收站为空')
  })

  it('renders deleted knowledge bases with restore button', () => {
    const wrapper = mountPage({
      deletedKnowledgeBases: [
        { id: '1', name: 'Old KB', icon: 'mdi-database', deleted_at: 1700000000000 },
      ],
    })
    expect(wrapper.text()).toContain('Old KB')
    expect(wrapper.text()).toContain('删除于')
    expect(wrapper.text()).toContain('恢复')
  })

  it('calls restoreKnowledgeBase when clicking restore', async () => {
    const wrapper = mountPage({
      deletedKnowledgeBases: [
        { id: 'kb1', name: 'Old KB', icon: 'mdi-database', deleted_at: 1700000000000 },
      ],
    })
    const store = useKnowledgeBaseStore()
    await wrapper.find('button').trigger('click')
    expect(store.restoreKnowledgeBase).toHaveBeenCalledWith('kb1')
  })
})
