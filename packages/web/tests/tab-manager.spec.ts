import { describe, test, expect, beforeEach, vi } from 'vitest'

vi.mock('@/router', () => ({
  router: {
    navigate: vi.fn().mockResolvedValue(undefined),
  },
}))

import { router } from '@/router'
import { tabManager } from '@/stores/tabManager'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { ROUTES_REGISTER } from '@/router-register'

const navigateMock = vi.mocked(router.navigate)

describe('tabManager', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset()
    navigateMock.mockClear()
  })

  test('openNewChat 创建新聊天标签并导航', async () => {
    const tab = await tabManager.openNewChat()

    expect(tab.type).toBe(ROUTES_REGISTER.chat.key)
    expect(tab.title).toBe('新会话')
    expect(useWorkspaceStore.getState().activeTabId).toBe(tab.id)
    expect(navigateMock).toHaveBeenCalledWith({ to: `/chat/${tab.id}` })
  })

  test('openNewChat 对已有空白 chat 标签只切换不新建', async () => {
    const first = await tabManager.openNewChat()
    navigateMock.mockClear()

    const second = await tabManager.openNewChat()

    expect(second.id).toBe(first.id)
    expect(useWorkspaceStore.getState().tabs).toHaveLength(1)
    expect(navigateMock).toHaveBeenCalledWith({ to: `/chat/${first.id}` })
  })

  test('openConversation 为不同会话创建多个会话页标签', async () => {
    await tabManager.openNewChat()
    const first = await tabManager.openConversation('conv-1', '会话 A')
    const second = await tabManager.openConversation('conv-2', '会话 B')

    const tabs = useWorkspaceStore.getState().tabs
    expect(tabs).toHaveLength(3)
    expect(first.id).not.toBe(second.id)
    expect(first.conversationId).toBe('conv-1')
    expect(second.conversationId).toBe('conv-2')
  })

  test('openConversation 为未打开会话创建新标签', async () => {
    const tab = await tabManager.openConversation('conv-1', '会话 A')

    expect(tab.conversationId).toBe('conv-1')
    expect(tab.title).toBe('会话 A')
    expect(useWorkspaceStore.getState().tabs).toHaveLength(1)
    expect(navigateMock).toHaveBeenCalledWith({ to: `/chat/${tab.id}` })
  })

  test('openConversation 将新标签追加到最右侧', async () => {
    await tabManager.openNewChat()
    const tab = await tabManager.openConversation('conv-1', '会话 A')

    const tabs = useWorkspaceStore.getState().tabs
    expect(tabs).toHaveLength(2)
    expect(tabs[tabs.length - 1].id).toBe(tab.id)
    expect(tabs[tabs.length - 1].conversationId).toBe('conv-1')
  })

  test('openConversation 对同一会话只切换不新建', async () => {
    const first = await tabManager.openConversation('conv-1', '会话 A')
    navigateMock.mockClear()

    const second = await tabManager.openConversation('conv-1')

    expect(second.id).toBe(first.id)
    expect(useWorkspaceStore.getState().tabs).toHaveLength(1)
    expect(navigateMock).toHaveBeenCalledWith({ to: `/chat/${first.id}` })
  })

  test('openHistory 创建单例会话历史标签', async () => {
    const tab = await tabManager.openHistory()

    expect(tab.type).toBe(ROUTES_REGISTER.history.key)
    expect(useWorkspaceStore.getState().tabs).toHaveLength(1)
    expect(navigateMock).toHaveBeenCalledWith({ to: ROUTES_REGISTER.history.path })
  })

  test('openHistory 第二次调用切换到已有标签', async () => {
    const first = await tabManager.openHistory()
    await tabManager.openNewChat()
    navigateMock.mockClear()

    const second = await tabManager.openHistory()

    expect(second.id).toBe(first.id)
    expect(useWorkspaceStore.getState().activeTabId).toBe(first.id)
    expect(navigateMock).toHaveBeenCalledWith({ to: ROUTES_REGISTER.history.path })
  })

  test('openKnowledge 创建单例知识库标签', async () => {
    const tab = await tabManager.openKnowledge()

    expect(tab.type).toBe(ROUTES_REGISTER.knowledgeBase.key)
    expect(useWorkspaceStore.getState().tabs).toHaveLength(1)
    expect(navigateMock).toHaveBeenCalledWith({ to: ROUTES_REGISTER.knowledgeBase.path })
  })

  test('switchTab 切换指定标签并导航', async () => {
    const tabA = await tabManager.openNewChat()
    await tabManager.openConversation('conv-1')
    navigateMock.mockClear()

    const result = await tabManager.switchTab(tabA.id)

    expect(result).toBe(true)
    expect(useWorkspaceStore.getState().activeTabId).toBe(tabA.id)
    expect(navigateMock).toHaveBeenCalledWith({ to: `/chat/${tabA.id}` })
  })

  test('switchTab 对不存在标签返回 false', async () => {
    const result = await tabManager.switchTab('not-exist')

    expect(result).toBe(false)
    expect(navigateMock).not.toHaveBeenCalled()
  })

  test('closeTab 关闭会话页后导航到左侧相邻标签', async () => {
    const homeTab = await tabManager.openNewChat()
    const convTab = await tabManager.openConversation('conv-1')
    navigateMock.mockClear()

    await tabManager.closeTab(convTab.id)

    expect(useWorkspaceStore.getState().tabs).toHaveLength(1)
    expect(useWorkspaceStore.getState().activeTab()?.id).toBe(homeTab.id)
    expect(navigateMock).toHaveBeenCalledTimes(1)
  })

  test('closeTab 关闭最后一个会话页后切回已有问答首页', async () => {
    await tabManager.openNewChat()
    const convTab = await tabManager.openConversation('conv-1')
    navigateMock.mockClear()

    await tabManager.closeTab(convTab.id)

    expect(useWorkspaceStore.getState().tabs).toHaveLength(1)
    expect(useWorkspaceStore.getState().activeTab()?.type).toBe(ROUTES_REGISTER.chat.key)
    expect(useWorkspaceStore.getState().activeTab()?.conversationId).toBeUndefined()
    expect(navigateMock).toHaveBeenCalled()
  })

  test('closeTab 不关闭不可关闭标签', async () => {
    useWorkspaceStore.getState().addTab({ type: ROUTES_REGISTER.chat.key, title: '固定', closable: false })
    const tab = useWorkspaceStore.getState().tabs[0]

    await tabManager.closeTab(tab.id)

    expect(useWorkspaceStore.getState().tabs).toHaveLength(1)
    expect(navigateMock).not.toHaveBeenCalled()
  })

  test('ensureChatTab 为不存在的 tabId 创建空白 chat 标签', () => {
    tabManager.ensureChatTab('orphan-tab')

    const tab = useWorkspaceStore.getState().tabs[0]
    expect(tab.id).toBe('orphan-tab')
    expect(tab.type).toBe(ROUTES_REGISTER.chat.key)
    expect(tab.title).toBe('新会话')
    expect(tab.closable).toBe(false)
    expect(tab.conversationId).toBeUndefined()
    expect(useWorkspaceStore.getState().activeTabId).toBe('orphan-tab')
  })

  test('ensureChatTab 对已存在 tabId 不重复创建', () => {
    useWorkspaceStore.getState().addTab({
      id: 'existing-tab',
      type: ROUTES_REGISTER.chat.key,
      title: '已有标签',
      closable: true,
    })

    tabManager.ensureChatTab('existing-tab')

    expect(useWorkspaceStore.getState().tabs).toHaveLength(1)
    expect(useWorkspaceStore.getState().tabs[0].title).toBe('已有标签')
  })

  test('openRoute 根据 ROUTES_REGISTER 打开单例路由', async () => {
    const tab = await tabManager.openRoute(ROUTES_REGISTER.settings.key)

    expect(tab.type).toBe(ROUTES_REGISTER.settings.key)
    expect(useWorkspaceStore.getState().tabs).toHaveLength(1)
    expect(navigateMock).toHaveBeenCalledWith({ to: ROUTES_REGISTER.settings.path })
  })

  test('openRoute 将新标签追加到最右侧', async () => {
    await tabManager.openNewChat()
    const tab = await tabManager.openRoute(ROUTES_REGISTER.history.key)

    const tabs = useWorkspaceStore.getState().tabs
    expect(tabs).toHaveLength(2)
    expect(tabs[tabs.length - 1].id).toBe(tab.id)
    expect(tabs[tabs.length - 1].type).toBe(ROUTES_REGISTER.history.key)
  })

  test('openRoute 对单例路由第二次调用切换到已有标签', async () => {
    const first = await tabManager.openRoute(ROUTES_REGISTER.settings.key)
    await tabManager.openNewChat()
    navigateMock.mockClear()

    const second = await tabManager.openRoute(ROUTES_REGISTER.settings.key)

    expect(second.id).toBe(first.id)
    expect(useWorkspaceStore.getState().activeTabId).toBe(first.id)
    expect(navigateMock).toHaveBeenCalledWith({ to: ROUTES_REGISTER.settings.path })
  })

  test('openRoute 对 chat 路由复用空白首页，对会话页新建多例标签', async () => {
    const homeTab = await tabManager.openRoute(ROUTES_REGISTER.chat.key)
    const second = await tabManager.openRoute(ROUTES_REGISTER.chat.key)

    expect(second.id).toBe(homeTab.id)
    expect(useWorkspaceStore.getState().tabs).toHaveLength(1)

    const convTab = await tabManager.openConversation('conv-1')
    expect(convTab.id).not.toBe(homeTab.id)
    expect(useWorkspaceStore.getState().tabs).toHaveLength(2)
  })

  test('openRoute 支持自定义标题', async () => {
    const tab = await tabManager.openRoute(ROUTES_REGISTER.recycle.key, { title: '自定义回收站' })

    expect(tab.title).toBe('自定义回收站')
    expect(navigateMock).toHaveBeenCalledWith({ to: ROUTES_REGISTER.recycle.path })
  })

  test('closeTab 关闭最后一个非首页标签后切换到已有问答首页', async () => {
    await tabManager.openNewChat()
    navigateMock.mockClear()

    const historyTab = await tabManager.openHistory()
    navigateMock.mockClear()

    await tabManager.closeTab(historyTab.id)

    const state = useWorkspaceStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.activeTab()?.type).toBe(ROUTES_REGISTER.chat.key)
    expect(navigateMock).toHaveBeenCalledWith({ to: expect.stringMatching(/^\/chat\//) })
  })

  test('openNewChat 对已存在的空白 chat 标签只切换不新建', async () => {
    const first = await tabManager.openNewChat()
    await tabManager.openHistory()
    navigateMock.mockClear()

    const second = await tabManager.openNewChat()

    expect(second.id).toBe(first.id)
    expect(useWorkspaceStore.getState().tabs).toHaveLength(2)
    expect(navigateMock).toHaveBeenCalledWith({ to: `/chat/${first.id}` })
  })
})
