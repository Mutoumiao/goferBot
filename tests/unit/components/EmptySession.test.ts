import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EmptySession from '@/components/EmptySession.vue'

describe('EmptySession', () => {
  it('renders quick question pills', () => {
    const wrapper = mount(EmptySession)
    expect(wrapper.text()).toContain('什么是 RAG 检索增强生成？')
    expect(wrapper.text()).toContain('如何导入 Markdown 文档？')
  })

  it('emits send when clicking a quick question', async () => {
    const wrapper = mount(EmptySession)
    const pills = wrapper.findAll('button').filter((b) =>
      b.text().includes('RAG')
    )
    await pills[0].trigger('click')
    expect(wrapper.emitted('send')).toHaveLength(1)
    expect(wrapper.emitted('send')![0]).toEqual(['什么是 RAG 检索增强生成？'])
  })

  it('emits send on Enter key', async () => {
    const wrapper = mount(EmptySession)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('hello')
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: false })
    expect(wrapper.emitted('send')).toHaveLength(1)
    expect(wrapper.emitted('send')![0]).toEqual(['hello'])
  })

  it('does not emit send on Shift+Enter', async () => {
    const wrapper = mount(EmptySession)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('newline')
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(wrapper.emitted('send')).toBeUndefined()
  })

  it('disables send button when input is empty', () => {
    const wrapper = mount(EmptySession)
    const btn = wrapper.find('button[disabled]')
    expect(btn.exists()).toBe(true)
  })

  it('emits send and clears input when clicking send button', async () => {
    const wrapper = mount(EmptySession)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('test message')

    const btn = wrapper.findAll('button').find((b) =>
      b.find('.i-mdi-arrow-up').exists()
    )
    await btn!.trigger('click')

    expect(wrapper.emitted('send')).toHaveLength(1)
    expect(wrapper.emitted('send')![0]).toEqual(['test message'])
    expect((textarea.element as HTMLTextAreaElement).value).toBe('')
  })
})
