import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MoveCopyDialog from '@/components/MoveCopyDialog.vue'
import { sidecarPort } from '@/composables/useSidecarStatus'
import { setShell } from '@/shell'
import { MemoryShell } from '@/shell/memory'

describe('MoveCopyDialog', () => {
  beforeEach(() => {
    sidecarPort.value = 11451
    setShell(new MemoryShell({ initialPort: 11451 }))
    global.fetch = vi.fn()
  })

  afterEach(() => {
    setShell(null)
  })

  function mountDialog(props: { visible: boolean; mode: 'move' | 'copy'; sourceKbId: string; sourcePath: string }) {
    return mount(MoveCopyDialog, {
      props,
      global: {
        stubs: { Teleport: true },
      },
    })
  }

  it('shows move title in move mode', () => {
    const wrapper = mountDialog({ visible: true, mode: 'move', sourceKbId: 'kb1', sourcePath: 'file.txt' })
    expect(wrapper.text()).toContain('移动到')
  })

  it('shows copy title in copy mode', () => {
    const wrapper = mountDialog({ visible: true, mode: 'copy', sourceKbId: 'kb1', sourcePath: 'file.txt' })
    expect(wrapper.text()).toContain('复制到')
  })

  it('emits close on cancel button click', async () => {
    const wrapper = mountDialog({ visible: true, mode: 'move', sourceKbId: 'kb1', sourcePath: 'file.txt' })
    const buttons = wrapper.findAll('button')
    const cancelBtn = buttons.find((b) => b.text() === '取消')
    expect(cancelBtn).toBeDefined()
    await cancelBtn!.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits close on overlay click', async () => {
    const wrapper = mountDialog({ visible: true, mode: 'move', sourceKbId: 'kb1', sourcePath: 'file.txt' })
    await wrapper.find('.bg-black\\/40').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('does not emit close on dialog content click', async () => {
    const wrapper = mountDialog({ visible: true, mode: 'move', sourceKbId: 'kb1', sourcePath: 'file.txt' })
    await wrapper.find('.flex-col.rounded-2xl').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})
