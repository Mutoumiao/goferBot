import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTabsStore } from '@/stores/tabs'

// Helper to get a fresh store import
async function getFreshState() {
  const { useTabsStore: fresh } = await import('@/stores/tabs')
  return fresh.getState()
}

describe('TabsStore — 类型 + 基础操作（任务 1-2）', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('AC-01: store 导出 useTabsStore', async () => {
    await getFreshState()
    expect(useTabsStore).toBeDefined()
  })

  it('AC-01: 初始时存在 home 标签（id=home, closable=false）', async () => {
    const store = await getFreshState()
    expect(store.tabs).toHaveLength(1)
    expect(store.tabs[0].id).toBe('home')
    expect(store.tabs[0].closable).toBe(false)
    expect(store.activeTabId).toBe('home')
  })

  it('AC-02: addTab 添加标签到列表末尾并激活', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const tab = useTabsStore.getState().addTab('chat', 's1', 'Chat 1', '/app/chat/s1')

    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(2)
    expect(state.tabs[1].id).toBe(tab.id)
    expect(state.tabs[1].type).toBe('chat')
    expect(state.activeTabId).toBe(tab.id)
  })

  it('AC-02: addTab 空 title 使用 type 作为默认标题', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const tab = useTabsStore.getState().addTab('history')

    expect(tab.title).toBe('history')
  })

  it('AC-05: activateTab 切换活跃标签', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const store = useTabsStore.getState()
    const tab = store.addTab('kb', undefined, 'KB')

    store.activateTab('home')
    expect(useTabsStore.getState().activeTabId).toBe('home')

    store.activateTab(tab.id)
    expect(useTabsStore.getState().activeTabId).toBe(tab.id)
  })

  it('AC-05: activateTab 传入不存在的 tabId 静默忽略', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const store = useTabsStore.getState()
    store.activateTab('nonexistent')
    expect(useTabsStore.getState().activeTabId).toBe('home')
  })
})

describe('TabsStore — addTabByRoute 去重（任务 3）', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('AC-03: addTabByRoute 无同 route 标签时创建新标签', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const result = useTabsStore.getState().addTabByRoute('/app/history', 'History', 'history')

    expect(result).not.toBeNull()
    expect(result!.type).toBe('history')
    expect(useTabsStore.getState().tabs).toHaveLength(2)
    expect(useTabsStore.getState().activeTabId).toBe(result!.id)
  })

  it('AC-03: addTabByRoute 有同 route 标签时激活已有标签，返回 null', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const store = useTabsStore.getState()
    const first = store.addTabByRoute('/app/history', 'History', 'history')
    expect(first).not.toBeNull()

    // 第二次调用同 route
    const second = useTabsStore.getState().addTabByRoute('/app/history', 'History', 'history')
    expect(second).toBeNull()
    expect(useTabsStore.getState().tabs).toHaveLength(2) // 仍然只有 home + 1
    expect(useTabsStore.getState().activeTabId).toBe(first!.id)
  })

  it('AC-03: addTabByRoute 空 route 返回 null', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const result = useTabsStore.getState().addTabByRoute('', 'Empty', 'chat')
    expect(result).toBeNull()
    expect(useTabsStore.getState().tabs).toHaveLength(1) // 只有 home
  })

  it('AC-03: addTabByRoute 同 type 不同 route 可共存', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const store = useTabsStore.getState()
    store.addTabByRoute('/app/chat/s1', 'Chat 1', 'chat')
    store.addTabByRoute('/app/chat/s2', 'Chat 2', 'chat')

    // 同 type 不同 route 应各自创建
    expect(useTabsStore.getState().tabs).toHaveLength(3) // home + 2 chats
  })
})

describe('TabsStore — removeTab + 关闭规则（任务 4-7）', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('AC-04: 关闭 home 标签 → 无操作', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    useTabsStore.getState().removeTab('home')

    expect(useTabsStore.getState().tabs).toHaveLength(1)
    expect(useTabsStore.getState().tabs[0].id).toBe('home')
  })

  it('AC-04: 关闭活跃标签 → 激活左侧相邻标签', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const store = useTabsStore.getState()
    const t1 = store.addTab('chat', 's1', 'Chat 1')
    const t2 = store.addTab('history', undefined, 'History')
    // activeTabId = t2 (last added)

    store.removeTab(t2.id)
    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(2) // home + t1
    expect(state.activeTabId).toBe(t1.id)
  })

  it('AC-04: 关闭时左侧无标签 → 创建 home', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const store = useTabsStore.getState()
    const t1 = store.addTab('kb', undefined, 'KB')
    // tabs = [home, t1], activeTabId = t1

    store.removeTab(t1.id)
    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0].id).toBe('home')
    expect(state.activeTabId).toBe('home')
  })

  it('AC-04: 关闭不在 active 位置的标签 → activeTabId 不变', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const store = useTabsStore.getState()
    store.addTab('chat', 's1', 'Chat')
    const t2 = store.addTab('history', undefined, 'History')
    store.activateTab('home')

    store.removeTab(t2.id)
    const state = useTabsStore.getState()
    expect(state.activeTabId).toBe('home')
  })

  it('AC-06: closeAllTabs 关闭所有可关闭标签 → 只剩 home', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const store = useTabsStore.getState()
    store.addTab('chat', 's1', 'Chat')
    store.addTab('history', undefined, 'History')
    store.addTab('kb', undefined, 'KB')

    store.closeAllTabs()
    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0].id).toBe('home')
    expect(state.activeTabId).toBe('home')
  })

  it('AC-06: closeOtherTabs 关闭除指定标签外的所有可关闭标签', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const store = useTabsStore.getState()
    store.addTab('chat', 's1', 'Chat')
    store.addTab('history', undefined, 'History')
    const t3 = store.addTab('kb', undefined, 'KB')

    store.closeOtherTabs(t3.id)
    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(2) // home + t3
    expect(state.tabs[1].id).toBe(t3.id)
    expect(state.activeTabId).toBe(t3.id)
  })

  it('AC-06: closeOtherTabs 传入不存在的 tabId → 无操作', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const store = useTabsStore.getState()
    store.addTab('chat', 's1', 'Chat')
    store.addTab('history', undefined, 'History')
    const before = useTabsStore.getState().tabs.length

    store.closeOtherTabs('nonexistent')
    const after = useTabsStore.getState()
    expect(after.tabs).toHaveLength(before) // 无变化
  })

  it('AC-07: 关闭后无标签时自动创建 home', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const store = useTabsStore.getState()
    const t1 = store.addTab('chat', 's1', 'Chat')
    // 尝试移除非 home 的最后一个标签
    store.removeTab(t1.id)

    expect(useTabsStore.getState().tabs).toHaveLength(1)
    expect(useTabsStore.getState().tabs[0].id).toBe('home')
  })
})

describe('TabsStore — persist（任务 8-9）', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('AC-08: persist 配置 name 为 goferbot-tabs', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    useTabsStore.getState().addTab('chat', 's1', 'Test')

    const stored = localStorage.getItem('goferbot-tabs')
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.tabs).toHaveLength(2) // home + chat
    expect(parsed.state).toHaveProperty('activeTabId')
  })

  it('AC-09: hydrate 恢复时 home 标签始终存在', async () => {
    const storedData = {
      state: {
        tabs: [
          { id: 'custom', type: 'chat', title: 'Custom', isDirty: false, closable: true },
        ],
        activeTabId: 'custom',
      },
      version: 0,
    }
    localStorage.setItem('goferbot-tabs', JSON.stringify(storedData))

    const { useTabsStore } = await import('@/stores/tabs')

    await new Promise<void>((resolve) => {
      if (useTabsStore.persist.hasHydrated()) { resolve(); return }
      const unsub = useTabsStore.persist.onFinishHydration(() => { unsub(); resolve() })
    })

    const state = useTabsStore.getState()
    const homeExists = state.tabs.some((t) => t.id === 'home')
    expect(homeExists).toBe(true)
  })

  it('AC-09: hydrate 恢复后 activeTabId 指向不存在的标签 → 重置为 home', async () => {
    const storedData = {
      state: {
        tabs: [{ id: 'home', type: 'chat', title: '首页', isDirty: false, closable: false }],
        activeTabId: 'nonexistent',
      },
      version: 0,
    }
    localStorage.setItem('goferbot-tabs', JSON.stringify(storedData))

    const { useTabsStore } = await import('@/stores/tabs')

    await new Promise<void>((resolve) => {
      if (useTabsStore.persist.hasHydrated()) { resolve(); return }
      const unsub = useTabsStore.persist.onFinishHydration(() => { unsub(); resolve() })
    })

    expect(useTabsStore.getState().activeTabId).toBe('home')
  })

  it('AC-09: localStorage 为空 → 使用初始状态（仅 home）', async () => {
    const { useTabsStore } = await import('@/stores/tabs')

    await new Promise<void>((resolve) => {
      if (useTabsStore.persist.hasHydrated()) { resolve(); return }
      const unsub = useTabsStore.persist.onFinishHydration(() => { unsub(); resolve() })
    })

    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0].id).toBe('home')
  })

  it('AC-09: localStorage 数据损坏 → 使用初始状态', async () => {
    localStorage.setItem('goferbot-tabs', 'invalid-json{{{')

    const { useTabsStore } = await import('@/stores/tabs')

    await new Promise<void>((resolve) => {
      const unsub = useTabsStore.persist.onFinishHydration(() => { unsub(); resolve() })
      setTimeout(() => { unsub(); resolve() }, 500)
      if (useTabsStore.persist.hasHydrated()) { unsub(); resolve() }
    })

    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0].id).toBe('home')
  }, 10000)
})

describe('TabsStore — 辅助方法（任务 10）', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('AC-10: renameTab 更新标签标题', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const store = useTabsStore.getState()
    const tab = store.addTab('chat', 's1', 'Old Title')

    store.renameTab(tab.id, 'New Title')
    expect(useTabsStore.getState().tabs.find((t) => t.id === tab.id)?.title).toBe('New Title')
  })

  it('AC-10: renameTab 对不存在的 tabId 静默忽略', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    expect(() => useTabsStore.getState().renameTab('nonexistent', 'X')).not.toThrow()
  })

  it('AC-10: setTabDirty 设置标签 dirty 标记', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const store = useTabsStore.getState()
    const tab = store.addTab('chat', 's1', 'Chat')

    store.setTabDirty(tab.id, true)
    expect(useTabsStore.getState().tabs.find((t) => t.id === tab.id)?.isDirty).toBe(true)

    store.setTabDirty(tab.id, false)
    expect(useTabsStore.getState().tabs.find((t) => t.id === tab.id)?.isDirty).toBe(false)
  })

  it('AC-10: updateHomeTabSession 更新 home 标签 session 信息', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const store = useTabsStore.getState()
    store.updateHomeTabSession('s-new', 'New Chat')

    const home = useTabsStore.getState().tabs.find((t) => t.id === 'home')
    expect(home?.sessionId).toBe('s-new')
    expect(home?.title).toBe('New Chat')
  })

  it('AC-10: updateActiveTabSession 更新当前活跃标签 session 信息', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const store = useTabsStore.getState()
    const tab = store.addTab('chat', undefined, 'Chat')
    // tab 已激活

    store.updateActiveTabSession('s-abc', 'Renamed')
    const updated = useTabsStore.getState().tabs.find((t) => t.id === tab.id)
    expect(updated?.sessionId).toBe('s-abc')
    expect(updated?.title).toBe('Renamed')
  })

  it('AC-10: activeTab 派生返回当前活跃标签对象', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const store = useTabsStore.getState()
    const tab = store.addTab('chat', 's1', 'Chat')

    expect(useTabsStore.getState().activeTab()).toEqual(tab)
    store.activateTab('home')
    expect(useTabsStore.getState().activeTab()?.id).toBe('home')
  })
})
