import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import RenameDialog from '@/overlays/dialogs/RenameDialog.vue'
import { OverlayCloseKey } from '@/overlays/host/symbols'

function mountDialog(props: Record<string, unknown> = {}) {
  const closeFn = vi.fn()
  const Wrapper = defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      return () => h(RenameDialog, {
        title: '重命名',
        initialValue: 'old-name.txt',
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

describe('RenameDialog', () => {
  it('AC-02: renders with title and initial value', () => {
    const { wrapper } = mountDialog()
    expect(wrapper.text()).toContain('重命名')
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('old-name.txt')
  })

  it('AC-02: shows error when submitting empty name', async () => {
    const { wrapper } = mountDialog()
    await wrapper.find('input').setValue('')
    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.text()).toContain('名称不能为空')
  })

  it('AC-02: calls onConfirm with new name on valid submit', async () => {
    const onConfirm = vi.fn()
    const { wrapper } = mountDialog({ onConfirm })
    await wrapper.find('input').setValue('new-name.txt')
    await wrapper.findAll('button')[1].trigger('click')
    expect(onConfirm).toHaveBeenCalledWith('new-name.txt')
  })

  it('AC-02: cancel closes without calling onConfirm', () => {
    const onConfirm = vi.fn()
    const { wrapper, closeFn } = mountDialog({ onConfirm })
    wrapper.findAll('button')[0].trigger('click')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(closeFn).toHaveBeenCalled()
  })
})
