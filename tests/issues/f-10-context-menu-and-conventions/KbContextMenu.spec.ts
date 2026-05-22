import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import KbContextMenu from '@/overlays/context-menus/KbContextMenu.vue'
import { OverlayCloseKey } from '@/overlays/host/symbols'

function mountMenu(props: Record<string, unknown> = {}) {
  const closeFn = vi.fn()
  const Wrapper = defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      return () => h(KbContextMenu, {
        x: 100,
        y: 200,
        kb: { id: 'kb-1', name: 'Test', isPinned: false },
        onAction: vi.fn(),
        ...props,
      })
    },
  })
  const wrapper = mount(Wrapper)
  return { wrapper, closeFn }
}

describe('KbContextMenu', () => {
  it('AC-02: renders pin menu item for unpinned kb', () => {
    const { wrapper } = mountMenu({ kb: { id: 'kb-1', name: 'Test', isPinned: false } })
    expect(wrapper.text()).toContain('置顶')
    expect(wrapper.text()).not.toContain('取消置顶')
  })

  it('AC-02: renders unpin menu item for pinned kb', () => {
    const { wrapper } = mountMenu({ kb: { id: 'kb-1', name: 'Test', isPinned: true } })
    const text = wrapper.text()
    expect(text).toContain('取消置顶')
    expect(text).not.toContain('取消置顶置顶')
  })

  it('AC-02: renders edit and delete items', () => {
    const { wrapper } = mountMenu()
    expect(wrapper.text()).toContain('编辑')
    expect(wrapper.text()).toContain('删除')
  })

  it('AC-03: calls close when clicking outside', async () => {
    const { wrapper, closeFn } = mountMenu()
    await wrapper.find('[data-testid="context-menu-overlay"]').trigger('click')
    expect(closeFn).toHaveBeenCalled()
  })

  it('AC-06: calls close on Escape key', () => {
    const { closeFn } = mountMenu()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(closeFn).toHaveBeenCalled()
  })

  it('AC-07: calls onAction with pin when pin clicked', async () => {
    const onAction = vi.fn()
    const { wrapper, closeFn } = mountMenu({ onAction })
    await wrapper.findAll('button')[0].trigger('click')
    expect(onAction).toHaveBeenCalledWith('pin', expect.objectContaining({ id: 'kb-1' }))
    expect(closeFn).toHaveBeenCalled()
  })
})
