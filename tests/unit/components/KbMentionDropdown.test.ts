import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import KbMentionDropdown from '@/components/KbMentionDropdown.vue'

describe('KbMentionDropdown', () => {
  const kbs = [
    { id: '1', name: 'Docs', icon: 'i-mdi-file-document', path: '/a', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0 },
    { id: '2', name: 'Notes', icon: 'i-mdi-note', path: '/b', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0 },
  ]

  it('renders filtered list when visible', () => {
    const wrapper = mount(KbMentionDropdown, {
      props: { knowledgeBases: kbs, query: 'Doc', visible: true },
    })
    expect(wrapper.findAll('.flex.cursor-pointer')).toHaveLength(1)
    expect(wrapper.text()).toContain('Docs')
  })

  it('emits select on click', async () => {
    const wrapper = mount(KbMentionDropdown, {
      props: { knowledgeBases: kbs, query: '', visible: true },
    })
    await wrapper.find('.flex.cursor-pointer').trigger('mousedown')
    expect(wrapper.emitted('select')).toHaveLength(1)
    expect((wrapper.emitted('select')![0] as any[])[0].id).toBe('1')
  })

  it('emits close on Escape', () => {
    const wrapper = mount(KbMentionDropdown, {
      props: { knowledgeBases: kbs, query: '', visible: true },
    })
    ;(wrapper.vm as any).handleKeydown(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
