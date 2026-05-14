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
    const headings = wrapper.findAll('h2')
    expect(headings.length).toBe(3)
    expect(headings[0].text()).toContain('LLM 提供商配置')
    expect(headings[1].text()).toContain('Embedding')
    expect(headings[2].text()).toContain('通用设置')
  })

  it('shows provider tabs', () => {
    const wrapper = mount(SettingsPage)
    expect(wrapper.text()).toContain('OpenAI')
    expect(wrapper.text()).toContain('Claude')
    expect(wrapper.text()).toContain('DeepSeek')
  })

  it('changing temperature marks dirty and save button becomes enabled', async () => {
    const wrapper = mount(SettingsPage)

    const saveBtn = wrapper.find('button:disabled')
    expect(saveBtn.exists()).toBe(true)

    const range = wrapper.find('input[type="range"]')
    await range.setValue('1.5')

    const enabledSave = wrapper.find('button:not(:disabled)')
    expect(enabledSave.text()).toBe('保存')
  })
})
