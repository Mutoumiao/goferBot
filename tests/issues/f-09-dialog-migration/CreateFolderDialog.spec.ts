import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import CreateFolderDialog from '@/overlays/dialogs/CreateFolderDialog.vue'
import { OverlayCloseKey } from '@/overlays/host/symbols'

function mountDialog(props: Record<string, unknown> = {}) {
  const closeFn = vi.fn()
  const Wrapper = defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      return () => h(CreateFolderDialog, {
        kbId: 'kb-1',
        parentFolderId: null,
        onConfirm: vi.fn(),
        ...props,
      })
    },
  })
  const wrapper = mount(Wrapper, {
    global: {
      stubs: {
        Dialog: {
          props: ['open'],
          template: '<div><slot /></div>',
        },
        DialogContent: { template: '<div><slot /></div>' },
        DialogHeader: { template: '<div><slot /></div>' },
        DialogTitle: { template: '<div><slot /></div>' },
        DialogFooter: { template: '<div><slot /></div>' },
      },
    },
  })
  return { wrapper, closeFn }
}

describe('CreateFolderDialog', () => {
  it('AC-01: renders dialog with title and input', () => {
    const { wrapper } = mountDialog()
    expect(wrapper.text()).toContain('新建文件夹')
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('AC-01: shows error when submitting empty name', async () => {
    const { wrapper } = mountDialog()
    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.text()).toContain('请输入文件夹名称')
  })

  it('AC-01: calls onConfirm with trimmed name on valid submit', async () => {
    const onConfirm = vi.fn()
    const { wrapper } = mountDialog({ onConfirm })
    await wrapper.find('input').setValue('My Folder')
    await wrapper.findAll('button')[1].trigger('click')
    expect(onConfirm).toHaveBeenCalledWith('My Folder')
  })

  it('AC-01: cancel button calls close without onConfirm', () => {
    const onConfirm = vi.fn()
    const { wrapper, closeFn } = mountDialog({ onConfirm })
    wrapper.findAll('button')[0].trigger('click')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(closeFn).toHaveBeenCalled()
  })
})
