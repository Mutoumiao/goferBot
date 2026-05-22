import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import OverlayHost from '@/overlays/host/OverlayHost.vue'
import { useOverlayHost } from '@/overlays/host/useOverlayHost'
import { h, defineComponent } from 'vue'

const TestDialog = defineComponent({
  name: 'TestDialog',
  props: ['title'],
  setup(props: { title: string }) {
    return () => h('div', { class: 'test-dialog' }, props.title)
  }
})

function querySelector(selector: string) {
  return document.querySelector(selector)
}

function querySelectorAll(selector: string) {
  return document.querySelectorAll(selector)
}

describe('OverlayHost', () => {
  let wrapper: ReturnType<typeof mount>

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    useOverlayHost().clearOverlays()
  })

  it('AC-02: should render nothing when no overlays', () => {
    wrapper = mount(OverlayHost, { attachTo: document.body })
    expect(querySelector('.overlay-host')).toBeNull()
  })

  it('AC-02: should render overlay components from queue', () => {
    useOverlayHost().addOverlay({ component: TestDialog, props: { title: 'Hello' }, type: 'dialog' })
    wrapper = mount(OverlayHost, { attachTo: document.body })
    expect(querySelector('.test-dialog')).not.toBeNull()
    expect(document.body.textContent).toContain('Hello')
  })

  it('AC-09: should assign increasing z-index to overlays', () => {
    useOverlayHost().addOverlay({ component: TestDialog, props: { title: 'A' }, type: 'dialog' })
    useOverlayHost().addOverlay({ component: TestDialog, props: { title: 'B' }, type: 'dialog' })
    wrapper = mount(OverlayHost, { attachTo: document.body })
    const items = querySelectorAll('.overlay-item')
    expect((items[0] as HTMLElement).style.zIndex).toBe('10000')
    expect((items[1] as HTMLElement).style.zIndex).toBe('10001')
  })

  it('AC-12: should skip rendering when child component throws error', () => {
    const ErrorDialog = defineComponent({
      setup() {
        throw new Error('render error')
      },
      render() {
        return h('div')
      }
    })
    useOverlayHost().addOverlay({ component: ErrorDialog, props: {}, type: 'dialog' })
    wrapper = mount(OverlayHost, { attachTo: document.body })
    // 渲染时报错的组件不会添加到 DOM
    expect(useOverlayHost().overlays).toHaveLength(0)
  })
})
