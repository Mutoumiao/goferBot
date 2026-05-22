import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import { defineDialog } from '@/overlays/composables/useDialog'
import { OverlayCloseKey } from '@/overlays/host/symbols'

function createTestComponent(closeFn: () => void) {
  return defineComponent({
    setup() {
      provide(OverlayCloseKey, closeFn)
      const TestChild = defineComponent({
        name: 'TestChild',
        setup() {
          return defineDialog()
        },
        render() { return h('div') }
      })
      return () => h(TestChild)
    }
  })
}

describe('defineDialog', () => {
  it('AC-06: should return isOpen as true by default', () => {
    const closeFn = vi.fn()
    const wrapper = mount(createTestComponent(closeFn))
    const child = wrapper.findComponent({ name: 'TestChild' })
    expect(child.vm.isOpen).toBe(true)
  })

  it('AC-06: should call inject close function when close is invoked', () => {
    const closeFn = vi.fn()
    const wrapper = mount(createTestComponent(closeFn))
    const child = wrapper.findComponent({ name: 'TestChild' })
    child.vm.close()
    expect(closeFn).toHaveBeenCalledTimes(1)
  })

  it('AC-06: should set isOpen to false when close is invoked', () => {
    const closeFn = vi.fn()
    const wrapper = mount(createTestComponent(closeFn))
    const child = wrapper.findComponent({ name: 'TestChild' })
    child.vm.close()
    expect(child.vm.isOpen).toBe(false)
  })
})
