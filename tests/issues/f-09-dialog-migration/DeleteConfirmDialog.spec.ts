import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import DeleteConfirmDialog from '@/overlays/dialogs/DeleteConfirmDialog.vue'
import { OverlayCloseKey } from '@/overlays/host/symbols'

function mountDialog(props: Record<string, unknown> = {}) {
  const closeFn = vi.fn()
  const Wrapper = defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      return () => h(DeleteConfirmDialog, {
        title: '删除确认',
        message: '确认删除「test」？',
        kind: 'danger',
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

describe('DeleteConfirmDialog', () => {
  it('AC-03: renders title and message', () => {
    const { wrapper } = mountDialog()
    expect(wrapper.text()).toContain('删除确认')
    expect(wrapper.text()).toContain('确认删除「test」？')
  })

  it('AC-03: calls onConfirm on confirm click', async () => {
    const onConfirm = vi.fn()
    const { wrapper } = mountDialog({ onConfirm })
    await wrapper.findAll('button')[1].trigger('click')
    expect(onConfirm).toHaveBeenCalled()
  })

  it('AC-03: cancel clicks close without calling onConfirm', () => {
    const onConfirm = vi.fn()
    const { wrapper, closeFn } = mountDialog({ onConfirm })
    wrapper.findAll('button')[0].trigger('click')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(closeFn).toHaveBeenCalled()
  })

  it('AC-03: applies danger button class when kind is danger', () => {
    const { wrapper } = mountDialog({ kind: 'danger' })
    const confirmBtn = wrapper.findAll('button')[1]
    expect(confirmBtn.classes()).toContain('bg-danger-500')
  })

  it('AC-03: respects custom confirmText', () => {
    const { wrapper } = mountDialog({ confirmText: 'Yes, Delete' })
    expect(wrapper.text()).toContain('Yes, Delete')
  })
})
