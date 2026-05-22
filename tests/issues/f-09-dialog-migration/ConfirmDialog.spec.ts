import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import ConfirmDialog from '@/overlays/dialogs/ConfirmDialog.vue'
import { OverlayCloseKey } from '@/overlays/host/symbols'

function mountDialog(props: Record<string, unknown> = {}) {
  const closeFn = vi.fn()
  const Wrapper = defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      return () => h(ConfirmDialog, {
        title: '提示',
        message: '确定删除文件吗？',
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

describe('ConfirmDialog', () => {
  it('AC-04: renders title and message', () => {
    const { wrapper } = mountDialog()
    expect(wrapper.text()).toContain('提示')
    expect(wrapper.text()).toContain('确定删除文件吗？')
  })

  it('AC-04: calls onConfirm on confirm and closes', async () => {
    const onConfirm = vi.fn()
    const { wrapper } = mountDialog({ onConfirm })
    await wrapper.findAll('button')[1].trigger('click')
    expect(onConfirm).toHaveBeenCalled()
  })

  it('AC-04: calls onCancel on cancel and closes', () => {
    const onCancel = vi.fn()
    const { wrapper, closeFn } = mountDialog({ onCancel })
    wrapper.findAll('button')[0].trigger('click')
    expect(onCancel).toHaveBeenCalled()
    expect(closeFn).toHaveBeenCalled()
  })

  it('AC-04: shows custom confirmText and cancelText', () => {
    const { wrapper } = mountDialog({ confirmText: '是', cancelText: '否' })
    expect(wrapper.text()).toContain('是')
    expect(wrapper.text()).toContain('否')
  })

  it('AC-04: renders with danger kind styling', () => {
    const { wrapper } = mountDialog({ kind: 'danger' })
    expect(wrapper.find('.text-danger-500').exists()).toBe(true)
  })
})
