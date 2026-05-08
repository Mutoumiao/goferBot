import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ContextMenu from '@/components/ContextMenu.vue'

describe('ContextMenu', () => {
  it('renders when visible', () => {
    mount(ContextMenu, {
      props: { visible: true, x: 100, y: 200 },
      slots: { default: '<div data-testid="slot">Item</div>' },
      attachTo: document.body,
    })
    expect(document.querySelector('[data-testid="slot"]')).not.toBeNull()
    expect(document.querySelector('[data-context-menu]')).not.toBeNull()
  })

  it('hides when visible is false', () => {
    const wrapper = mount(ContextMenu, {
      props: { visible: false, x: 100, y: 200 },
      slots: { default: '<div data-testid="slot">Item</div>' },
    })
    expect(wrapper.find('[data-testid="slot"]').exists()).toBe(false)
  })

  it('emits close when clicking outside', async () => {
    const wrapper = mount(ContextMenu, {
      props: { visible: true, x: 100, y: 200 },
      attachTo: document.body,
    })
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.click()
    expect(wrapper.emitted('close')).toBeTruthy()
    document.body.removeChild(outside)
  })

  it('emits close when pressing Escape', async () => {
    const wrapper = mount(ContextMenu, {
      props: { visible: true, x: 100, y: 200 },
      attachTo: document.body,
    })
    await wrapper.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
