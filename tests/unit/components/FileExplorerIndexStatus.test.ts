import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import KnowledgeBasePage from '@/components/KnowledgeBasePage.vue'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

describe('KnowledgeBasePage index status', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('computes indexProgress correctly', async () => {
    const wrapper = mount(KnowledgeBasePage)
    const vm = wrapper.vm as any

    vm.store.knowledgeBases = [{ id: 'kb1', name: 'Test', path: '/a', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-database' }]
    vm.store.selectedKbId = 'kb1'
    vm.store.indexStatus.set('kb1', { totalFiles: 10, indexedFiles: 5, pendingFiles: 0 })
    await nextTick()

    expect(vm.indexProgress).toBe(50)
  })

  it('computes indexProgress 0 when totalFiles is 0', async () => {
    const wrapper = mount(KnowledgeBasePage)
    const vm = wrapper.vm as any

    vm.store.selectedKbId = 'kb1'
    vm.store.indexStatus.set('kb1', { totalFiles: 0, indexedFiles: 0, pendingFiles: 0 })
    await nextTick()

    expect(vm.indexProgress).toBe(0)
  })
})
