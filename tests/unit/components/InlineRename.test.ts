import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import InlineRename from '@/components/InlineRename.vue'

describe('InlineRename', () => {
  it('shows input with base name selected on mount', () => {
    const wrapper = mount(InlineRename, {
      props: { name: 'document.md', editing: true },
    })
    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect(input.element.value).toBe('document')
  })

  it('emits save on Enter', async () => {
    const wrapper = mount(InlineRename, {
      props: { name: 'old.txt', editing: true },
    })
    const input = wrapper.find('input')
    await input.setValue('newname')
    await input.trigger('keyup', { key: 'Enter' })
    expect(wrapper.emitted('save')).toEqual([['newname']])
  })

  it('emits cancel on Escape', async () => {
    const wrapper = mount(InlineRename, {
      props: { name: 'old.txt', editing: true },
    })
    const input = wrapper.find('input')
    await input.trigger('keyup', { key: 'Escape' })
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('emits save on blur', async () => {
    const wrapper = mount(InlineRename, {
      props: { name: 'old.txt', editing: true },
    })
    const input = wrapper.find('input')
    await input.setValue('newname')
    await input.trigger('blur')
    expect(wrapper.emitted('save')).toEqual([['newname']])
  })
})
