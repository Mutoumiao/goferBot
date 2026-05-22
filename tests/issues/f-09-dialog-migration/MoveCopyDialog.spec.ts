import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import MoveCopyDialog from '@/overlays/dialogs/MoveCopyDialog.vue'
import { OverlayCloseKey } from '@/overlays/host/symbols'
import { createPinia, setActivePinia } from 'pinia'

function mountDialog(props: Record<string, unknown> = {}) {
  setActivePinia(createPinia())
  const closeFn = vi.fn()
  const Wrapper = defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      return () => h(MoveCopyDialog, {
        mode: 'move',
        sourceKbId: 'kb-1',
        sourcePath: '/',
        onConfirm: vi.fn(),
        ...props,
      })
    },
  })
  const wrapper = mount(Wrapper, {
    global: {
      stubs: {
        Dialog: { props: ['open'], template: '<div><slot /></div>' },
        DialogContent: { template: '<div><slot /></div>' },
        DialogHeader: { template: '<div><slot /></div>' },
        DialogTitle: { template: '<div><slot /></div>' },
        DialogFooter: { template: '<div><slot /></div>' },
      },
    },
  })
  return { wrapper, closeFn }
}

describe('MoveCopyDialog', () => {
  it('AC-06: renders with mode title "移动到" for move', () => {
    const { wrapper } = mountDialog({ mode: 'move' })
    expect(wrapper.text()).toContain('移动到')
  })

  it('AC-06: renders with mode title "复制到" for copy', () => {
    const { wrapper } = mountDialog({ mode: 'copy' })
    expect(wrapper.text()).toContain('复制到')
  })

  it('AC-06: cancel closes without calling onConfirm', async () => {
    const onConfirm = vi.fn()
    const { wrapper, closeFn } = mountDialog({ onConfirm })
    const btns = wrapper.findAll('button')
    const cancelBtn = btns.find((b) => b.text() === '取消')
    await cancelBtn?.trigger('click')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(closeFn).toHaveBeenCalled()
  })
})
