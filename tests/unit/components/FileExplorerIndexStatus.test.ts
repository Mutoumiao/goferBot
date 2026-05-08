import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import KnowledgeBasePage from '@/components/KnowledgeBasePage.vue'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { sidecarFetch } from '@/utils/sidecarClient'

vi.mock('@/utils/sidecarClient')

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

  it('renders progress bar with correct width', async () => {
    const wrapper = mount(KnowledgeBasePage)
    const vm = wrapper.vm as any

    vm.store.selectedKbId = 'kb1'
    vm.store.indexStatus.set('kb1', { totalFiles: 10, indexedFiles: 3, pendingFiles: 0 })
    await nextTick()

    const barContainer = wrapper.find('.gap-2.py-1\\.5')
    expect(barContainer.exists()).toBe(true)
    const bar = barContainer.find('.bg-accent-500')
    expect(bar.exists()).toBe(true)
    expect(bar.attributes('style')).toContain('width: 30%')
  })

  it('calls loadIndexStatus when selecting kb', async () => {
    const wrapper = mount(KnowledgeBasePage)
    const vm = wrapper.vm as any

    const loadSpy = vi.spyOn(vm.store, 'loadIndexStatus').mockResolvedValue(undefined)

    await vm.onSelectKb('kb1')

    expect(loadSpy).toHaveBeenCalledWith('kb1')
  })
})

describe('useKnowledgeBaseStore loadIndexStatus', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(sidecarFetch).mockReset()
  })

  it('updates indexStatus Map on success', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ totalFiles: 10, indexedFiles: 5, pendingFiles: 0 }),
    } as Response)

    const { useKnowledgeBaseStore } = await import('@/stores/knowledgeBase')
    const store = useKnowledgeBaseStore()
    await store.loadIndexStatus('kb1')

    expect(store.indexStatus.get('kb1')).toEqual({ totalFiles: 10, indexedFiles: 5, pendingFiles: 0 })
  })
})
