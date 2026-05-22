import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import FileExplorerContextMenu from '@/overlays/context-menus/FileExplorerContextMenu.vue'
import { OverlayCloseKey } from '@/overlays/host/symbols'

function mountMenu(props: Record<string, unknown> = {}) {
  const closeFn = vi.fn()
  const Wrapper = defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      return () => h(FileExplorerContextMenu, {
        x: 100,
        y: 200,
        fileName: null,
        onAction: vi.fn(),
        ...props,
      })
    },
  })
  const wrapper = mount(Wrapper)
  return { wrapper, closeFn }
}

describe('FileExplorerContextMenu', () => {
  it('AC-02: renders background menu items when fileName is null', () => {
    const { wrapper } = mountMenu({ fileName: null })
    expect(wrapper.text()).toContain('新建文件夹')
    expect(wrapper.text()).not.toContain('重命名')
  })

  it('AC-02: renders file menu items when fileName is set', () => {
    const { wrapper } = mountMenu({ fileName: 'test.txt' })
    expect(wrapper.text()).toContain('重命名')
    expect(wrapper.text()).toContain('移动')
    expect(wrapper.text()).toContain('复制')
    expect(wrapper.text()).toContain('删除')
    expect(wrapper.text()).not.toContain('新建文件夹')
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

  it('AC-07: calls onAction and close when menu item clicked', async () => {
    const onAction = vi.fn()
    const { wrapper, closeFn } = mountMenu({ fileName: 'test.txt', onAction })
    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')
    expect(onAction).toHaveBeenCalledWith('rename', 'test.txt')
    expect(closeFn).toHaveBeenCalled()
  })

  it('AC-04: adjusts position when near bottom edge', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true })
    const { wrapper } = mountMenu({ x: 100, y: 350 })
    const el = wrapper.find('[data-testid="context-menu"]')
    const top = (el.element as HTMLElement).style.top
    expect(parseInt(top)).toBeLessThan(350)
  })
})
