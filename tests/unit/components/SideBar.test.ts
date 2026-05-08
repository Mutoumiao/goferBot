import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SideBar from '@/components/SideBar.vue'

describe('SideBar', () => {
  it('renders navigation items', () => {
    const wrapper = mount(SideBar, {
      props: { activeType: 'chat' },
    })
    expect(wrapper.text()).toContain('问答')
    expect(wrapper.text()).toContain('知识库')
    expect(wrapper.text()).toContain('历史')
    expect(wrapper.text()).toContain('设置')
  })

  it('emits openChat when clicking chat nav', async () => {
    const wrapper = mount(SideBar, {
      props: { activeType: 'chat' },
    })
    const chatBtn = wrapper.findAll('button').find((b) => b.text() === '问答')
    await chatBtn!.trigger('click')
    expect(wrapper.emitted('openChat')).toHaveLength(1)
  })

  it('emits openKnowledgeBase when clicking kb nav', async () => {
    const wrapper = mount(SideBar, {
      props: { activeType: 'chat' },
    })
    const kbBtn = wrapper.findAll('button').find((b) => b.text() === '知识库')
    await kbBtn!.trigger('click')
    expect(wrapper.emitted('openKnowledgeBase')).toHaveLength(1)
  })

  it('emits openHistory when clicking history nav', async () => {
    const wrapper = mount(SideBar, {
      props: { activeType: 'chat' },
    })
    const histBtn = wrapper.findAll('button').find((b) => b.text() === '历史')
    await histBtn!.trigger('click')
    expect(wrapper.emitted('openHistory')).toHaveLength(1)
  })

  it('emits openSettings when clicking settings nav', async () => {
    const wrapper = mount(SideBar, {
      props: { activeType: 'chat' },
    })
    const setBtn = wrapper.findAll('button').find((b) => b.text() === '设置')
    await setBtn!.trigger('click')
    expect(wrapper.emitted('openSettings')).toHaveLength(1)
  })

  it('shows active indicator for active item', () => {
    const wrapper = mount(SideBar, {
      props: { activeType: 'knowledgeBase' },
    })
    const kbBtn = wrapper.findAll('button').find((b) => b.text() === '知识库')
    expect(kbBtn!.find('[class*="bg-accent-500"]').exists()).toBe(true)
  })

  it('does not show active indicator for inactive items', () => {
    const wrapper = mount(SideBar, {
      props: { activeType: 'chat' },
    })
    const kbBtn = wrapper.findAll('button').find((b) => b.text() === '知识库')
    expect(kbBtn!.find('[class*="bg-accent-500"]').exists()).toBe(false)
  })
})
