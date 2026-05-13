import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatInput from '@/components/ChatInput.vue'

describe('ChatInput', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders a textarea element', () => {
    const wrapper = mount(ChatInput)
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('emits send on button click', async () => {
    const wrapper = mount(ChatInput)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('hello')
    await wrapper.find('[data-testid="chat-send-btn"]').trigger('click')
    expect(wrapper.emitted('send')).toHaveLength(1)
    expect(wrapper.emitted('send')![0]).toEqual(['hello', []])
  })

  it('emits send on Enter key', async () => {
    const wrapper = mount(ChatInput)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('world')
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: false })
    expect(wrapper.emitted('send')).toHaveLength(1)
    expect(wrapper.emitted('send')![0]).toEqual(['world', []])
  })

  it('does not emit send on Shift+Enter', async () => {
    const wrapper = mount(ChatInput)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('newline')
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(wrapper.emitted('send')).toBeUndefined()
  })

  it('does not emit send when empty', async () => {
    const wrapper = mount(ChatInput)
    await wrapper.find('[data-testid="chat-send-btn"]').trigger('click')
    expect(wrapper.emitted('send')).toBeUndefined()
  })

  it('clears input after send', async () => {
    const wrapper = mount(ChatInput)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('test')
    await wrapper.find('[data-testid="chat-send-btn"]').trigger('click')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('')
  })

  it('does not emit when loading', async () => {
    const wrapper = mount(ChatInput, { props: { loading: true } })
    const textarea = wrapper.find('textarea')
    await textarea.setValue('test')
    await wrapper.find('[data-testid="chat-send-btn"]').trigger('click')
    expect(wrapper.emitted('send')).toBeUndefined()
  })
})
