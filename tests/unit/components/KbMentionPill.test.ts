import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import KbMentionPill from '@/components/KbMentionPill.vue'

describe('KbMentionPill', () => {
  const kb = { id: 'kb1', name: 'Docs', icon: 'mdi-books', path: '/docs', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0 }

  it('renders knowledge base name', () => {
    const wrapper = mount(KbMentionPill, { props: { kb } })
    expect(wrapper.text()).toContain('Docs')
  })

  it('renders custom icon', () => {
    const wrapper = mount(KbMentionPill, { props: { kb } })
    expect(wrapper.html()).toContain('mdi-books')
  })

  it('renders default database icon when no icon', () => {
    const kbNoIcon = { ...kb, icon: '' }
    const wrapper = mount(KbMentionPill, { props: { kb: kbNoIcon } })
    expect(wrapper.html()).toContain('i-mdi-database')
  })

  it('emits remove on close button click', async () => {
    const wrapper = mount(KbMentionPill, { props: { kb } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })
})