import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ChatInput from '@/components/ChatInput.vue'

const mockKbs = [
  { id: 'kb-1', name: 'KB A', documentCount: 2 },
  { id: 'kb-2', name: 'KB B', documentCount: 5 },
]

describe('ChatInput KB selection', () => {
  it('AC-01: renders KbSelector and toggles selection', async () => {
    const wrapper = mount(ChatInput, {
      props: { knowledgeBases: mockKbs, loading: false, disabled: false },
    })
    const btn = wrapper.find('[data-testid="chat-kb-btn"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(wrapper.find('[data-testid="kb-selector-dropdown"]').isVisible()).toBe(true)
  })

  it('AC-06: sends message with selected knowledgeBaseIds', async () => {
    const wrapper = mount(ChatInput, {
      props: { knowledgeBases: mockKbs, loading: false, disabled: false },
    })
    // open dropdown and select first kb
    await wrapper.find('[data-testid="chat-kb-btn"]').trigger('click')
    const items = wrapper.findAll('[data-testid="kb-selector-item"]')
    await items[0].trigger('mousedown')
    await nextTick()

    // type and send
    const textarea = wrapper.find('textarea')
    await textarea.setValue('hello')
    await wrapper.find('[data-testid="chat-send-btn"]').trigger('click')

    expect(wrapper.emitted('send')).toBeTruthy()
    expect(wrapper.emitted('send')![0]).toEqual(['hello', ['kb-1']])
  })

  it('AC-07: sends message without knowledgeBaseIds when none selected', async () => {
    const wrapper = mount(ChatInput, {
      props: { knowledgeBases: mockKbs, loading: false, disabled: false },
    })
    const textarea = wrapper.find('textarea')
    await textarea.setValue('hello')
    await wrapper.find('[data-testid="chat-send-btn"]').trigger('click')

    expect(wrapper.emitted('send')).toBeTruthy()
    expect(wrapper.emitted('send')![0]).toEqual(['hello', []])
  })

  it('AC-08: removes pill when clicking X', async () => {
    const wrapper = mount(ChatInput, {
      props: { knowledgeBases: mockKbs, loading: false, disabled: false },
    })
    await wrapper.find('[data-testid="chat-kb-btn"]').trigger('click')
    await wrapper.findAll('[data-testid="kb-selector-item"]')[0].trigger('mousedown')
    await nextTick()
    expect(wrapper.findAll('[data-testid="kb-mention-pill"]').length).toBe(1)

    await wrapper.find('[data-testid="kb-mention-pill-remove"]').trigger('click')
    await nextTick()
    expect(wrapper.findAll('[data-testid="kb-mention-pill"]').length).toBe(0)
  })

  it('AC-09: clears selected KBs after send', async () => {
    const wrapper = mount(ChatInput, {
      props: { knowledgeBases: mockKbs, loading: false, disabled: false },
    })
    await wrapper.find('[data-testid="chat-kb-btn"]').trigger('click')
    await wrapper.findAll('[data-testid="kb-selector-item"]')[0].trigger('mousedown')
    await nextTick()

    const textarea = wrapper.find('textarea')
    await textarea.setValue('hello')
    await wrapper.find('[data-testid="chat-send-btn"]').trigger('click')
    await nextTick()

    expect(wrapper.findAll('[data-testid="kb-mention-pill"]').length).toBe(0)
  })
})
