import { describe, test, expect } from 'vitest'
import { migrateWorkspaceState, type WorkspaceStore } from '@/stores/workspace.store'

describe('migrateWorkspaceState', () => {
  test('旧数据 chat 标签 closable 被修复为 true', () => {
    const persisted: WorkspaceStore = {
      tabs: [
        { id: 't1', type: 'chat', title: '问答首页', closable: false, createdAt: 1 },
        { id: 't2', type: 'chat', title: '会话1', conversationId: 'c1', closable: false, createdAt: 2 },
        { id: 't3', type: 'history', title: '历史', closable: true, createdAt: 3 },
      ],
      activeTabId: 't1',
      activeTab: () => null,
      addTab: () => ({ id: '', type: 'chat', title: '', closable: true, createdAt: 0 }),
      removeTab: () => ({ removed: false }),
      switchTab: () => false,
      renameTab: () => {},
      updateTab: () => {},
      findTabByConversationId: () => null,
      findTabByType: () => null,
      reset: () => {},
    }

    const migrated = migrateWorkspaceState(persisted, 0)

    expect(migrated.tabs[0].closable).toBe(true)
    expect(migrated.tabs[1].closable).toBe(true)
    expect(migrated.tabs[2].closable).toBe(true)
    expect(migrated.activeTabId).toBe('t1')
  })

  test('version 1 不修改数据', () => {
    const persisted: WorkspaceStore = {
      tabs: [
        { id: 't1', type: 'chat', title: '问答首页', closable: false, createdAt: 1 },
      ],
      activeTabId: 't1',
      activeTab: () => null,
      addTab: () => ({ id: '', type: 'chat', title: '', closable: true, createdAt: 0 }),
      removeTab: () => ({ removed: false }),
      switchTab: () => false,
      renameTab: () => {},
      updateTab: () => {},
      findTabByConversationId: () => null,
      findTabByType: () => null,
      reset: () => {},
    }

    const migrated = migrateWorkspaceState(persisted, 1)

    expect(migrated.tabs[0].closable).toBe(false)
  })

  test('空数据安全处理', () => {
    expect(migrateWorkspaceState(undefined, 0)).toBeUndefined()
    expect(migrateWorkspaceState(null, 0)).toBeNull()
  })
})
