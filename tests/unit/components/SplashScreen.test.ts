import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SplashScreen from '@/components/SplashScreen.vue'
import {
  sidecarStatus,
  sidecarError,
  _resetSidecarStatusForTest,
} from '@/composables/useSidecarStatus'
import { setShell } from '@/shell'
import { MemoryShell } from '@/shell/memory'

describe('SplashScreen', () => {
  beforeEach(() => {
    _resetSidecarStatusForTest()
    setShell(new MemoryShell({ initialPort: 11451 }))
  })

  it('shows loading state when sidecar is loading', () => {
    sidecarStatus.value = 'loading'
    sidecarError.value = ''

    const wrapper = mount(SplashScreen)
    expect(wrapper.text()).toContain('正在启动服务')
    expect(wrapper.find('.animate-spin').exists()).toBe(true)
  })

  it('shows error state when sidecar fails', () => {
    sidecarStatus.value = 'error'
    sidecarError.value = 'Connection failed'

    const wrapper = mount(SplashScreen)
    expect(wrapper.text()).toContain('服务启动失败')
    expect(wrapper.text()).toContain('Connection failed')
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('does not render when sidecar is ready', () => {
    sidecarStatus.value = 'ready'
    sidecarError.value = ''

    const wrapper = mount(SplashScreen)
    expect(wrapper.find('.fixed').exists()).toBe(false)
  })

  it('renders retry button in error state', () => {
    sidecarStatus.value = 'error'
    sidecarError.value = 'fail'

    const wrapper = mount(SplashScreen)
    expect(wrapper.find('button').text()).toContain('重试')
  })
})
