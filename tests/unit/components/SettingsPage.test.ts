import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import SettingsPage from '@/components/SettingsPage.vue'
import { useSettingsStore } from '@/stores/settings'

describe('SettingsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders three card sections', () => {
    const wrapper = mount(SettingsPage)
    const text = wrapper.text()
    expect(text).toContain('LLM 提供商配置')
    expect(text).toContain('Embedding API')
    expect(text).toContain('通用配置')
  })

  it('shows provider tabs', () => {
    const wrapper = mount(SettingsPage)
    expect(wrapper.text()).toContain('OpenAI')
    expect(wrapper.text()).toContain('Claude')
    expect(wrapper.text()).toContain('DeepSeek')
  })

  it('changing temperature marks dirty and save button becomes enabled', async () => {
    const wrapper = mount(SettingsPage)

    const saveBtn = wrapper.find('[data-testid="settings-save-btn"]')
    expect(saveBtn.attributes('disabled')).toBeDefined()

    const range = wrapper.find('input[type="range"]')
    await range.setValue('1.5')

    const enabledSave = wrapper.find('[data-testid="settings-save-btn"]')
    expect(enabledSave.attributes('disabled')).toBeUndefined()
    expect(enabledSave.text()).toBe('保存')
  })
})
