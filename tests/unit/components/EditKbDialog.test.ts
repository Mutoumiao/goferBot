import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import EditKbDialog from '@/components/EditKbDialog.vue'
import { TeleportStub, TransitionStub, DialogPortalStub } from '../stubs'

const stubs = {
  Teleport: TeleportStub,
  Transition: TransitionStub,
  DialogPortal: DialogPortalStub,
}

function mountDialog(props?: Record<string, unknown>) {
  return mount(EditKbDialog, {
    props: {
      visible: true,
      initialName: 'Test KB',
      initialIcon: 'mdi-database',
      ...props,
    },
    global: { stubs },
  })
}

describe('EditKbDialog', () => {
  it('renders when visible', () => {
    const wrapper = mountDialog()
    expect(wrapper.text()).toContain('修改资料')
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('pre-fills icon from props and highlights selected icon', () => {
    const wrapper = mountDialog({ initialName: 'My KB', initialIcon: 'mdi-books' })
    const selectedBtn = wrapper.findAll('button').find((b) =>
      b.classes().some((c) => c.includes('border-accent-500'))
    )
    expect(selectedBtn?.find('svg').classes()).toContain('lucide-book')
  })

  it('preserves initial name when saving without editing', async () => {
    const wrapper = mountDialog({ initialName: 'My KB', initialIcon: 'mdi-books' })
    await wrapper.find('input').setValue('My KB')
    await wrapper.findAll('button').find((b) => b.text().includes('保存'))!.trigger('click')
    expect(wrapper.emitted('save')![0]).toEqual(['My KB', 'mdi-books'])
  })

  it('shows error and prevents save when name is empty', async () => {
    const wrapper = mountDialog()
    const input = wrapper.find('input')
    await input.setValue('')
    await wrapper.findAll('button').find((b) => b.text().includes('保存'))!.trigger('click')

    expect(wrapper.text()).toContain('请输入知识库名称')
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('emits save with trimmed name and selected icon', async () => {
    const wrapper = mountDialog({ initialName: 'Old', initialIcon: 'mdi-database' })
    const input = wrapper.find('input')
    await input.setValue('  New Name  ')

    // Select a different icon
    const booksBtn = wrapper.findAll('button').find((b) =>
      b.find('svg').classes().includes('lucide-book')
    )
    await booksBtn!.trigger('click')

    await wrapper.findAll('button').find((b) => b.text().includes('保存'))!.trigger('click')

    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('save')![0]).toEqual(['New Name', 'mdi-books'])
  })

  it('emits close when clicking cancel', async () => {
    const wrapper = mountDialog()
    await wrapper.findAll('button').find((b) => b.text().includes('取消'))!.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('re-initializes values when visible becomes true again', async () => {
    const wrapper = mount(EditKbDialog, {
      props: { visible: false, initialName: 'First', initialIcon: 'mdi-database' },
      global: { stubs },
    })

    await wrapper.setProps({ visible: true, initialName: 'Second', initialIcon: 'mdi-books' })
    await nextTick()
    const input = wrapper.find('input')
    expect(input.element.value).toBe('Second')
  })
})
