import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatInput from '@/components/ChatInput.vue'

describe('ChatInput mention', () => {
  const kbs = [
    { id: '1', name: 'Docs', icon: 'i-mdi-file-document', path: '/a', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0 },
  ]

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('emits send with knowledgeBaseIds', async () => {
    const wrapper = mount(ChatInput, {
      props: { loading: false, knowledgeBases: kbs },
    })

    const textarea = wrapper.find('textarea')
    await textarea.setValue('hello')
    await (wrapper.vm as any).onSelectKb(kbs[0])
    await textarea.setValue('hello')

    await (wrapper.vm as any).handleSend()
    expect(wrapper.emitted('send')).toHaveLength(1)
    expect(wrapper.emitted('send')![0]).toEqual(['hello', ['1']])
  })

  it('renders selected kb pills', async () => {
    const wrapper = mount(ChatInput, {
      props: { loading: false, knowledgeBases: kbs },
    })
    await (wrapper.vm as any).onSelectKb(kbs[0])
    expect(wrapper.text()).toContain('Docs')
  })
})
