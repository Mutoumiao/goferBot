import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import EditKbDialog from '@/overlays/dialogs/EditKbDialog.vue'
import { OverlayCloseKey } from '@/overlays/host/symbols'

function mountDialog(props: Record<string, unknown> = {}) {
  const closeFn = vi.fn()
  const Wrapper = defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      return () => h(EditKbDialog, {
        kbId: 'kb-1',
        initialName: 'My KB',
        initialIcon: 'mdi-database',
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

describe('EditKbDialog', () => {
  it('AC-05: renders with title "修改资料" and initial name', () => {
    const { wrapper } = mountDialog()
    expect(wrapper.text()).toContain('修改资料')
    const input = wrapper.find('[data-testid="edit-kb-name-input"]')
    expect((input.element as HTMLInputElement).value).toBe('My KB')
  })

  it('AC-05: shows error when submitting empty name', async () => {
    const { wrapper } = mountDialog()
    const input = wrapper.find('[data-testid="edit-kb-name-input"]')
    await input.setValue('')
    await wrapper.findAll('button')[wrapper.findAll('button').length - 1].trigger('click')
    expect(wrapper.text()).toContain('请输入知识库名称')
  })

  it('AC-05: calls onConfirm with name and icon on valid submit', async () => {
    const onConfirm = vi.fn()
    const { wrapper } = mountDialog({ onConfirm })
    await wrapper.findAll('button')[wrapper.findAll('button').length - 1].trigger('click')
    expect(onConfirm).toHaveBeenCalledWith('My KB', 'mdi-database')
  })

  it('AC-05: cancel closes without calling onConfirm', async () => {
    const onConfirm = vi.fn()
    const { wrapper, closeFn } = mountDialog({ onConfirm })
    const btns = wrapper.findAll('button')
    const cancelBtn = btns.find((b) => b.text() === '取消')
    await cancelBtn?.trigger('click')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(closeFn).toHaveBeenCalled()
  })
})
