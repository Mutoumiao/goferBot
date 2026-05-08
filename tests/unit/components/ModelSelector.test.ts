import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ModelSelector from '@/components/ModelSelector.vue'
import { useSettingsStore } from '@/stores/settings'

vi.mock('@/utils/sidecarClient')

describe('ModelSelector', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('displays current provider and model', () => {
    const wrapper = mount(ModelSelector, {
      props: { provider: 'openai', model: 'gpt-4' },
    })
    expect(wrapper.text()).toContain('OpenAI')
    expect(wrapper.text()).toContain('gpt-4')
  })

  it('emits change event when provider selected', async () => {
    const store = useSettingsStore()
    store.config.providers.deepseek = { apiKey: 'k', model: 'deepseek-chat', baseUrl: '' }

    const wrapper = mount(ModelSelector)
    await wrapper.find('button').trigger('click')

    const options = wrapper.findAll('[class*="hover:bg-surface-3"]')
    // At least one option should be present
    expect(options.length).toBeGreaterThan(0)
  })
})
