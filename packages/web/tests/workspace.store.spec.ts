import { describe, test, expect, beforeEach } from 'vitest'
import { useWorkspaceStore, type Tab } from '@/stores/workspace.store'
import { ROUTES_REGISTER } from '@/router-register'

function makeChatTab(overrides?: Partial<Tab>): Omit<Tab, 'id' | 'createdAt'> {
  return {
    type: ROUTES_REGISTER.chat.key,
    title: '新会话',
    closable: true,
    ...overrides,
  }
}

describe('WorkspaceStore', () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset()
  })

  test('addTab 创建标签并激活它', () => {
    const tab = useWorkspaceStore.getState().addTab(makeChatTab({ title: '标签 1' }))

    expect(tab.title).toBe('标签 1')
    expect(tab.type).toBe(ROUTES_REGISTER.chat.key)
    expect(tab.closable).toBe(true)
    expect(useWorkspaceStore.getState().tabs).toHaveLength(1)
    expect(useWorkspaceStore.getState().activeTabId).toBe(tab.id)
    expect(useWorkspaceStore.getState().activeTab()?.id).toBe(tab.id)
  })

  test('addTab 支持显式指定 id', () => {
    const tab = useWorkspaceStore.getState().addTab({ ...makeChatTab({ title: '指定 id' }), id: 'tab-explicit' })

    expect(tab.id).toBe('tab-explicit')
  })

  test('switchTab 切换活跃标签', () => {
    const store = useWorkspaceStore.getState()
    const tabA = store.addTab(makeChatTab({ title: 'A' }))
    const tabB = store.addTab(makeChatTab({ title: 'B' }))

    expect(useWorkspaceStore.getState().activeTabId).toBe(tabB.id)

    const switched = store.switchTab(tabA.id)
    expect(switched).toBe(true)
    expect(useWorkspaceStore.getState().activeTabId).toBe(tabA.id)
  })

  test('switchTab 对不存在的标签返回 false', () => {
    useWorkspaceStore.getState().addTab(makeChatTab())

    const switched = useWorkspaceStore.getState().switchTab('not-exist')
    expect(switched).toBe(false)
  })

  test('removeTab 删除活跃标签并切换到左侧相邻标签', () => {
    const store = useWorkspaceStore.getState()
    const tabA = store.addTab(makeChatTab({ title: 'A' }))
    const tabB = store.addTab(makeChatTab({ title: 'B' }))
    const tabC = store.addTab(makeChatTab({ title: 'C' }))

    const result = store.removeTab(tabC.id)

    expect(result.removed).toBe(true)
    if (!result.removed) return
    expect(useWorkspaceStore.getState().tabs).toHaveLength(2)
    expect(useWorkspaceStore.getState().tabs.map((t) => t.id)).toEqual([tabA.id, tabB.id])
    expect(useWorkspaceStore.getState().activeTabId).toBe(tabB.id)
    expect(result.nextTab?.id).toBe(tabB.id)
  })

  test('removeTab 删除非活跃标签时保持当前活跃标签', () => {
    const store = useWorkspaceStore.getState()
    const tabA = store.addTab(makeChatTab({ title: 'A' }))
    store.addTab(makeChatTab({ title: 'B' }))
    const tabC = store.addTab(makeChatTab({ title: 'C' }))

    const result = store.removeTab(tabA.id)

    expect(result.removed).toBe(true)
    if (!result.removed) return
    expect(useWorkspaceStore.getState().tabs).toHaveLength(2)
    expect(useWorkspaceStore.getState().activeTabId).toBe(tabC.id)
    expect(result.nextTab?.id).toBe(tabC.id)
  })

  test('removeTab 拒绝关闭不可关闭标签', () => {
    const tab = useWorkspaceStore.getState().addTab(makeChatTab({ closable: false }))

    const result = useWorkspaceStore.getState().removeTab(tab.id)

    expect(result.removed).toBe(false)
    expect(useWorkspaceStore.getState().tabs).toHaveLength(1)
  })

  test('renameTab 更新标签标题', () => {
    const tab = useWorkspaceStore.getState().addTab(makeChatTab({ title: '旧标题' }))

    useWorkspaceStore.getState().renameTab(tab.id, '新标题')

    expect(useWorkspaceStore.getState().activeTab()?.title).toBe('新标题')
  })

  test('updateTab 更新标签 conversationId', () => {
    const tab = useWorkspaceStore.getState().addTab(makeChatTab())

    useWorkspaceStore.getState().updateTab(tab.id, { conversationId: 'conv-123', title: '已绑定' })

    const updated = useWorkspaceStore.getState().activeTab()
    expect(updated?.conversationId).toBe('conv-123')
    expect(updated?.title).toBe('已绑定')
  })

  test('findTabByConversationId 按 conversationId 查找', () => {
    const tab = useWorkspaceStore.getState().addTab(makeChatTab({ conversationId: 'conv-42' }))
    useWorkspaceStore.getState().addTab(makeChatTab())

    const found = useWorkspaceStore.getState().findTabByConversationId('conv-42')
    expect(found?.id).toBe(tab.id)

    const notFound = useWorkspaceStore.getState().findTabByConversationId('conv-missing')
    expect(notFound).toBeNull()
  })

  test('findTabByType 按类型查找单例标签', () => {
    useWorkspaceStore.getState().addTab(makeChatTab())
    const historyTab = useWorkspaceStore.getState().addTab({ type: ROUTES_REGISTER.history.key, title: '会话历史', closable: true })

    const found = useWorkspaceStore.getState().findTabByType(ROUTES_REGISTER.history.key)
    expect(found?.id).toBe(historyTab.id)

    const notFound = useWorkspaceStore.getState().findTabByType(ROUTES_REGISTER.knowledgeBase.key)
    expect(notFound).toBeNull()
  })

  test('activeTab 在空 store 时返回 null', () => {
    expect(useWorkspaceStore.getState().activeTab()).toBeNull()
    expect(useWorkspaceStore.getState().activeTabId).toBe('')
  })
})
