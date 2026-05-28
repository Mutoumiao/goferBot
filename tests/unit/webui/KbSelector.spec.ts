import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import KbSelector from '@/components/chat/KbSelector.vue'

const mockKb = { id: 'kb-1', name: '测试知识库', documentCount: 3 }

describe('KbSelector', () => {
  it('AC-01: renders list with checkboxes when data is available', () => {
    const wrapper = mount(KbSelector, {
      props: {
        knowledgeBases: [mockKb],
        selectedIds: [],
        visible: true,
        loading: false,
        error: null,
      },
    })
    expect(wrapper.findAll('[data-testid="kb-selector-item"]').length).toBe(1)
    expect(wrapper.text()).toContain('测试知识库')
    expect(wrapper.text()).toContain('3 文档')
  })

  it('AC-02: displays skeleton while loading knowledge bases', () => {
    const wrapper = mount(KbSelector, {
      props: {
        knowledgeBases: [],
        selectedIds: [],
        visible: true,
        loading: true,
        error: null,
      },
    })
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('AC-03: shows empty hint when no knowledge bases exist', () => {
    const wrapper = mount(KbSelector, {
      props: {
        knowledgeBases: [],
        selectedIds: [],
        visible: true,
        loading: false,
        error: null,
      },
    })
    expect(wrapper.text()).toContain('请先创建知识库')
  })

  it('AC-04: shows error and retry button on load failure', async () => {
    const wrapper = mount(KbSelector, {
      props: {
        knowledgeBases: [],
        selectedIds: [],
        visible: true,
        loading: false,
        error: '加载失败',
      },
    })
    expect(wrapper.text()).toContain('加载失败')
    const retryBtn = wrapper.find('[data-testid="kb-selector-retry"]')
    expect(retryBtn.exists()).toBe(true)
    await retryBtn.trigger('click')
    expect(wrapper.emitted('retry')).toBeTruthy()
  })

  it('AC-05: keyboard navigation works in dropdown', async () => {
    const wrapper = mount(KbSelector, {
      props: {
        knowledgeBases: [
          { id: 'kb-1', name: 'A', documentCount: 0 },
          { id: 'kb-2', name: 'B', documentCount: 0 },
        ],
        selectedIds: [],
        visible: true,
        loading: false,
        error: null,
      },
    })
    const dropdown = wrapper.findComponent(KbSelector)
    // ArrowDown moves selectedIndex from 0 to 1
    dropdown.vm.handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    await wrapper.vm.$nextTick()
    // Enter selects kb-2
    dropdown.vm.handleKeydown(new KeyboardEvent('keydown', { key: 'Enter' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')![0]).toEqual([expect.objectContaining({ id: 'kb-2' })])
  })
})
