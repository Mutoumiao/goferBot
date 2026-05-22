import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import FileContextMenu from '@/overlays/context-menus/FileContextMenu.vue'
import { OverlayCloseKey } from '@/overlays/host/symbols'

function mountMenu(props: Record<string, unknown> = {}) {
  const closeFn = vi.fn()
  const Wrapper = defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      return () => h(FileContextMenu, {
        x: 100,
        y: 200,
        item: null,
        onAction: vi.fn(),
        ...props,
      })
    },
  })
  const wrapper = mount(Wrapper)
  return { wrapper, closeFn }
}

describe('FileContextMenu', () => {
  it('AC-01: renders background menu items when item is null', () => {
    const { wrapper } = mountMenu({ item: null })
    expect(wrapper.text()).toContain('新建文件夹')
    expect(wrapper.text()).not.toContain('打开')
  })

  it('AC-01: renders file menu items when item is a document', () => {
    const { wrapper } = mountMenu({ item: { id: 'd1', name: 'doc.pdf', status: 'ready' } })
    expect(wrapper.text()).toContain('打开')
    expect(wrapper.text()).toContain('重命名')
    expect(wrapper.text()).toContain('删除')
    expect(wrapper.text()).not.toContain('新建文件夹')
  })

  it('AC-01: renders folder menu items when item is a folder', () => {
    const { wrapper } = mountMenu({ item: { id: 'f1', name: 'folder' } })
    expect(wrapper.text()).toContain('打开')
    expect(wrapper.text()).toContain('重命名')
    expect(wrapper.text()).toContain('删除')
    expect(wrapper.text()).not.toContain('新建文件夹')
  })

  it('AC-03: calls close when clicking outside', async () => {
    const { wrapper, closeFn } = mountMenu()
    await wrapper.find('[data-testid="context-menu-overlay"]').trigger('click')
    expect(closeFn).toHaveBeenCalled()
  })

  it('AC-06: calls close on Escape key', async () => {
    const { closeFn } = mountMenu()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(closeFn).toHaveBeenCalled()
  })

  it('AC-07: calls onAction and close when menu item clicked', async () => {
    const onAction = vi.fn()
    const { wrapper, closeFn } = mountMenu({ item: null, onAction })
    await wrapper.find('button').trigger('click')
    expect(onAction).toHaveBeenCalledWith('createFolder', undefined)
    expect(closeFn).toHaveBeenCalled()
  })

  it('AC-04: adjusts position when near right edge', () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true })
    const { wrapper } = mountMenu({ x: 350, y: 100 })
    const el = wrapper.find('[data-testid="context-menu"]')
    const left = (el.element as HTMLElement).style.left
    expect(parseInt(left)).toBeLessThan(350)
  })
})
