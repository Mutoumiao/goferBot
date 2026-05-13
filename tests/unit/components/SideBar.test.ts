import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SideBar from '@/components/SideBar.vue'

describe('SideBar', () => {
  it('renders navigation items with icons', () => {
    const wrapper = mount(SideBar, {
      props: { activeType: 'chat' },
    })
    expect(wrapper.find('.i-mdi-message-text-outline').exists()).toBe(true)
    expect(wrapper.find('.i-mdi-database-outline').exists()).toBe(true)
    expect(wrapper.find('.i-mdi-history').exists()).toBe(true)
    expect(wrapper.find('.i-mdi-cog-outline').exists()).toBe(true)
  })

  it('emits openChat when clicking chat nav', async () => {
    const wrapper = mount(SideBar, {
      props: { activeType: 'chat' },
    })
    const chatBtn = wrapper.findAll('button').find((b) =>
      b.find('.i-mdi-message-text-outline').exists()
    )
    await chatBtn!.trigger('click')
    expect(wrapper.emitted('openChat')).toHaveLength(1)
  })

  it('emits openKnowledgeBase when clicking kb nav', async () => {
    const wrapper = mount(SideBar, {
      props: { activeType: 'chat' },
    })
    const kbBtn = wrapper.findAll('button').find((b) =>
      b.find('.i-mdi-database-outline').exists()
    )
    await kbBtn!.trigger('click')
    expect(wrapper.emitted('openKnowledgeBase')).toHaveLength(1)
  })

  it('emits openHistory when clicking history nav', async () => {
    const wrapper = mount(SideBar, {
      props: { activeType: 'chat' },
    })
    const histBtn = wrapper.findAll('button').find((b) =>
      b.find('.i-mdi-history').exists()
    )
    await histBtn!.trigger('click')
    expect(wrapper.emitted('openHistory')).toHaveLength(1)
  })

  it('emits openSettings when clicking settings nav', async () => {
    const wrapper = mount(SideBar, {
      props: { activeType: 'chat' },
    })
    const setBtn = wrapper.findAll('button').find((b) =>
      b.find('.i-mdi-cog-outline').exists()
    )
    await setBtn!.trigger('click')
    expect(wrapper.emitted('openSettings')).toHaveLength(1)
  })

  it('shows active indicator for active item', () => {
    const wrapper = mount(SideBar, {
      props: { activeType: 'knowledgeBase' },
    })
    const kbBtn = wrapper.findAll('button').find((b) =>
      b.find('.i-mdi-database-outline').exists()
    )
    expect(kbBtn!.classes()).toContain('bg-nav-active')
  })

  it('does not show active indicator for inactive items', () => {
    const wrapper = mount(SideBar, {
      props: { activeType: 'chat' },
    })
    const kbBtn = wrapper.findAll('button').find((b) =>
      b.find('.i-mdi-database-outline').exists()
    )
    expect(kbBtn!.classes()).not.toContain('bg-nav-active')
  })
})
