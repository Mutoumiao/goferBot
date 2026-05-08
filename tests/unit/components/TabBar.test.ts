import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TabBar from '@/components/TabBar.vue'

const tabs = [
  { id: 'home', type: 'chat' as const, title: '首页', closable: false },
  { id: 't1', type: 'chat' as const, title: '会话1', closable: true },
  { id: 'kb', type: 'knowledgeBase' as const, title: '知识库', closable: true },
  { id: 'hist', type: 'history' as const, title: '历史', closable: true },
  { id: 'set', type: 'settings' as const, title: '设置', closable: true },
]

describe('TabBar', () => {
  it('renders all tabs', () => {
    const wrapper = mount(TabBar, {
      props: { tabs, activeTabId: 'home' },
    })
    expect(wrapper.text()).toContain('首页')
    expect(wrapper.text()).toContain('会话1')
    expect(wrapper.text()).toContain('知识库')
  })

  it('emits switch when clicking a tab', async () => {
    const wrapper = mount(TabBar, {
      props: { tabs, activeTabId: 'home' },
    })
    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.emitted('switch')).toHaveLength(1)
    expect(wrapper.emitted('switch')![0]).toEqual(['t1'])
  })

  it('emits close when clicking close button on closable tab', async () => {
    const wrapper = mount(TabBar, {
      props: { tabs, activeTabId: 'home' },
    })
    // Close button is a span inside the tab button, use findAll to get tabs, then find close icon
    const tabButtons = wrapper.findAll('button').filter((b) => b.text().includes('会话1'))
    const closeIcon = tabButtons[0].find('.i-mdi-close')
    await closeIcon.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('close')![0]).toEqual(['t1'])
  })

  it('does not show close button on non-closable tab', () => {
    const wrapper = mount(TabBar, {
      props: { tabs, activeTabId: 'home' },
    })
    const homeTab = wrapper.findAll('button').find((b) => b.text().includes('首页'))
    expect(homeTab!.find('.i-mdi-close').exists()).toBe(false)
  })

  it('emits newChat when clicking new chat button', async () => {
    const wrapper = mount(TabBar, {
      props: { tabs, activeTabId: 'home' },
    })
    const newChatBtn = wrapper.findAll('button').find((b) => b.text().includes('新会话'))
    await newChatBtn!.trigger('click')
    expect(wrapper.emitted('newChat')).toHaveLength(1)
  })

  it('shows different icons for different tab types', () => {
    const wrapper = mount(TabBar, {
      props: { tabs, activeTabId: 'home' },
    })
    const kbTab = wrapper.findAll('button').find((b) => b.text().includes('知识库'))
    const histTab = wrapper.findAll('button').find((b) => b.text().includes('历史'))
    const setTab = wrapper.findAll('button').find((b) => b.text().includes('设置'))

    expect(kbTab!.find('.i-mdi-folder').exists()).toBe(true)
    expect(histTab!.find('.i-mdi-history').exists()).toBe(true)
    expect(setTab!.find('.i-mdi-cog').exists()).toBe(true)
  })
})
