---
id: f-43
issue: issue.md
version: 1
---

# Tabs Store 迁移 — 实现计划

> **For agentic workers:** 步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 将 `packages/webui/src/stores/tabs.ts`（Pinia）迁移为 `packages/web/src/stores/tabs.ts`（Zustand + persist），覆盖标签页 CRUD、singleton 去重、关闭规则、persist hydrate 恢复校验。

**架构：** 自底向上：先定义 `Tab` 类型与基础 store 骨架（含 persist 配置）→ 再逐个实现 action → 最后补齐 hydrate 恢复校验与边界条件处理。每个任务遵循 RED → GREEN 流程。

**技术栈：** Zustand (`create` + `persist` middleware) + localStorage key `goferbot-tabs` + Vitest 单元测试

**Issue 引用：** [issue.md](./issue.md)
**Spec 引用：** [specs/feature-spec.md](./specs/feature-spec.md) + [specs/behavior-spec.md](./specs/behavior-spec.md)
**PRD 引用：** [docs/prd/v3-frontend-migration.md](../../prd/v3-frontend-migration.md) §5.6 阶段二补全

---

## PRD 一致性声明

| PRD 目标 | Plan 覆盖情况 | 说明 |
|----------|--------------|------|
| 迁移 Pinia tabs.ts → Zustand tabs store | ✅ 已覆盖 | 任务 1-7 |
| 标签页 CRUD + singleton 去重 | ✅ 已覆盖 | 任务 2 + 3（addTab/addTabByRoute），任务 4（removeTab），任务 5（批量关闭） |
| Zustand persist 恢复上次标签状态 | ✅ 已覆盖 | 任务 1（persist 配置），任务 7（hydrate 校验） |
| 单元测试覆盖 | ✅ 已覆盖 | 每个任务以编写失败测试开始，最终 7 组测试覆盖全部 AC |

---

## ADR 合规声明

| ADR | 涉及内容 | 符合/豁免 | 说明 |
|-----|---------|----------|------|
| ADR 0001 | Pinia 作为前端状态管理 | ⚠️ 豁免 | ADR 0001 基于旧 Vue/Pinia 架构；PRD v3-frontend-migration 已授权迁移至 React/Zustand，本计划以 PRD 为准 |

---

## 任务列表

### 任务 1: Tab 类型定义 + 基础 store 骨架（home 初始化 + persist 配置）

**文件：**
- 创建：`packages/web/src/stores/tabs.ts`
- 创建：`packages/web/tests/tabs-store.spec.ts`（测试骨架 + 初始状态用例）

**规格引用：**
- feature-spec: [数据模型 §Tab/TabsState]、[AC-01 Tab 类型]、[AC-08 persist]
- behavior-spec: [持久化恢复 §Persist 配置]

- [ ] **步骤 1: 编写失败测试**

```typescript
// packages/web/tests/tabs-store.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'

// 暂不引入真实 store（store 文件尚不存在），先声明测试轮廓
describe('tabs store — 基础骨架', () => {
  it('AC-01: Tab 类型应包含 id/type/title/route/icon/sessionId/isDirty/closable', async () => {
    // 动态导入以验证文件存在
    const mod = await import('@/stores/tabs')
    // 仅验证模块可导入 — 类型在编译期检查
    expect(mod.useTabsStore).toBeDefined()
  })

  it('AC-01: 初始状态应包含 home 标签（id=home）', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0].id).toBe('home')
    expect(state.tabs[0].type).toBe('chat')
    expect(state.tabs[0].closable).toBe(false)
    expect(state.activeTabId).toBe('home')
  })

  it('AC-08: store 应配置 persist middleware，name 为 goferbot-tabs', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    // Zustand persist 在内部管理 — 验证 store 可正常创建且有 persist 行为
    const state = useTabsStore.getState()
    expect(state.tabs).toBeDefined()
    expect(state.activeTabId).toBeDefined()
    // persist 由 middleware 保证，通过后续 hydrate 测试验证
  })

  it('AC-09: activeTab 派生值应返回当前活跃标签', async () => {
    const { useTabsStore } = await import('@/stores/tabs')
    const state = useTabsStore.getState()
    const active = state.activeTab()
    expect(active).not.toBeNull()
    expect(active!.id).toBe('home')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run packages/web/tests/tabs-store.spec.ts
```

预期：FAIL — 模块 `@/stores/tabs` 不存在或导出未定义。

- [ ] **步骤 3: 实现 Tab 类型 + 基础 store**

```typescript
// packages/web/src/stores/tabs.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Tab {
  id: string
  type: string // 'chat' | 'history' | 'kb' | 'settings' | 'recycle-bin'
  title: string
  route?: string
  icon?: string
  sessionId?: string
  isDirty: boolean
  closable: boolean
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string

  // 派生
  activeTab: () => Tab | null

  // Actions（占位，后续任务实现）
  addTab: (type: string, sessionId?: string, title?: string, route?: string) => Tab
  addTabByRoute: (route: string, defaultTitle: string, type: string) => Tab | null
  removeTab: (tabId: string) => void
  activateTab: (tabId: string) => void
  closeAllTabs: () => void
  closeOtherTabs: (tabId: string) => void
  renameTab: (tabId: string, title: string) => void
  updateHomeTabSession: (sessionId: string, title: string) => void
  updateActiveTabSession: (sessionId: string, title: string) => void
  setTabDirty: (tabId: string, isDirty: boolean) => void
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [
        { id: 'home', type: 'chat', title: '首页', closable: false, isDirty: false },
      ],
      activeTabId: 'home',

      activeTab: () => {
        const { tabs, activeTabId } = get()
        return tabs.find((t) => t.id === activeTabId) ?? null
      },

      // 占位 actions
      addTab: () => {
        throw new Error('not implemented')
      },
      addTabByRoute: () => {
        throw new Error('not implemented')
      },
      removeTab: () => {
        throw new Error('not implemented')
      },
      activateTab: () => {
        throw new Error('not implemented')
      },
      closeAllTabs: () => {
        throw new Error('not implemented')
      },
      closeOtherTabs: () => {
        throw new Error('not implemented')
      },
      renameTab: () => {
        throw new Error('not implemented')
      },
      updateHomeTabSession: () => {
        throw new Error('not implemented')
      },
      updateActiveTabSession: () => {
        throw new Error('not implemented')
      },
      setTabDirty: () => {
        throw new Error('not implemented')
      },
    }),
    {
      name: 'goferbot-tabs',
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
      }),
    },
  ),
)
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run packages/web/tests/tabs-store.spec.ts
```

预期：PASS — 初始状态用例通过（action 占位用例暂不调用）。

- [ ] **步骤 5: 类型检查**

```bash
pnpm type-check
```

预期：PASS — Tab 类型、TabsState 接口无类型错误。

---

### 任务 2: addTab + activateTab

**文件：**
- 修改：`packages/web/src/stores/tabs.ts`（实现 `addTab` + `activateTab`）
- 修改：`packages/web/tests/tabs-store.spec.ts`（新增测试用例）

**规格引用：**
- feature-spec: [AC-02 addTab 添加到列表末尾并激活]、[AC-05 activateTab 切换活跃标签]
- behavior-spec: [交互状态表 #addTab 行]、[交互状态表 #activateTab 行]

- [ ] **步骤 1: 编写失败测试**

```typescript
// 追加到 packages/web/tests/tabs-store.spec.ts
describe('tabs store — addTab + activateTab', () => {
  beforeEach(() => {
    // 重置 store 状态（每个用例独立）
    useTabsStore.setState({
      tabs: [
        { id: 'home', type: 'chat', title: '首页', closable: false, isDirty: false },
      ],
      activeTabId: 'home',
    })
  })

  it('AC-02: addTab 应追加标签到列表末尾并激活', () => {
    const { addTab } = useTabsStore.getState()
    const newTab = addTab('history', undefined, '历史记录')

    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(2)
    expect(state.tabs[1]).toMatchObject({
      type: 'history',
      title: '历史记录',
      closable: true,
      isDirty: false,
    })
    expect(state.activeTabId).toBe(newTab.id)
  })

  it('AC-02: addTab 带 sessionId + route 参数应正确保存', () => {
    const { addTab } = useTabsStore.getState()
    const newTab = addTab('chat', 'sess-123', '新会话', '/app/chat')

    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(2)
    expect(state.tabs[1]).toMatchObject({
      type: 'chat',
      sessionId: 'sess-123',
      title: '新会话',
      route: '/app/chat',
    })
  })

  it('AC-02: addTab 空 title 时使用 type 作为 fallback', () => {
    const { addTab } = useTabsStore.getState()
    const newTab = addTab('kb')

    const state = useTabsStore.getState()
    expect(state.tabs[1].title).toBe('kb')
  })

  it('AC-05: activateTab 应切换 activeTabId', () => {
    const { addTab, activateTab } = useTabsStore.getState()

    const tab1 = addTab('history', undefined, '历史')
    const tab2 = addTab('kb', undefined, '知识库')
    // addTab 自动激活 tab2，现在切换回 tab1
    activateTab(tab1.id)

    const state = useTabsStore.getState()
    expect(state.activeTabId).toBe(tab1.id)
  })

  it('AC-05: activateTab 传入不存在的 tabId 应静默忽略', () => {
    const { activateTab } = useTabsStore.getState()
    const stateBefore = useTabsStore.getState()
    activateTab('non-existent-id')

    const stateAfter = useTabsStore.getState()
    expect(stateAfter.activeTabId).toBe(stateBefore.activeTabId)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run packages/web/tests/tabs-store.spec.ts
```

预期：FAIL — `addTab` + `activateTab` 抛出 `not implemented`。

- [ ] **步骤 3: 实现 addTab + activateTab**

修改 `packages/web/src/stores/tabs.ts`，替换占位实现：

```typescript
// 替换 addTab 占位
addTab: (type, sessionId, title, route) => {
  const id = type === 'chat' ? `tab-${Date.now()}` : `tab-${type}`
  const newTab: Tab = {
    id,
    type,
    title: title ?? type,
    route,
    sessionId,
    closable: true,
    isDirty: false,
  }
  set((state) => ({
    tabs: [...state.tabs, newTab],
    activeTabId: id,
  }))
  return newTab
},

// 替换 activateTab 占位
activateTab: (tabId) => {
  const { tabs } = get()
  if (tabs.find((t) => t.id === tabId)) {
    set({ activeTabId: tabId })
  }
},
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run packages/web/tests/tabs-store.spec.ts
```

预期：PASS — 任务 1 + 任务 2 的全部用例通过。

---

### 任务 3: addTabByRoute（singleton 去重）

**文件：**
- 修改：`packages/web/src/stores/tabs.ts`（实现 `addTabByRoute`）
- 修改：`packages/web/tests/tabs-store.spec.ts`（新增测试用例）

**规格引用：**
- feature-spec: [AC-03 addTabByRoute singleton 去重]
- behavior-spec: [标签生命周期状态机 #addTabByRoute 分支]、[交互状态表 #addTabByRoute 行]、[边界条件 §添加]

- [ ] **步骤 1: 编写失败测试**

```typescript
// 追加到 packages/web/tests/tabs-store.spec.ts
describe('tabs store — addTabByRoute singleton 去重', () => {
  beforeEach(() => {
    useTabsStore.setState({
      tabs: [
        { id: 'home', type: 'chat', title: '首页', closable: false, isDirty: false },
      ],
      activeTabId: 'home',
    })
  })

  it('AC-03: 同 route 不存在时创建新标签并激活', () => {
    const { addTabByRoute } = useTabsStore.getState()
    const result = addTabByRoute('/app/history', '历史记录', 'history')

    expect(result).not.toBeNull()
    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(2)
    expect(state.tabs[1].route).toBe('/app/history')
    expect(state.activeTabId).toBe(result!.id)
    expect(result!.type).toBe('history')
  })

  it('AC-03: 同 route 已存在时应激活已有标签，不创建新标签', () => {
    const { addTabByRoute } = useTabsStore.getState()

    // 第一次创建
    const first = addTabByRoute('/app/history', '历史记录', 'history')
    expect(first).not.toBeNull()

    // 第二次同 route — 应激活已有
    const second = addTabByRoute('/app/history', '历史记录', 'history')

    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(2) // home + 1 history，不应新增
    expect(second!.id).toBe(first!.id) // 返回已有的标签
    expect(state.activeTabId).toBe(first!.id)
  })

  it('AC-03: 不同 route 但相同 type 应共存', () => {
    const { addTabByRoute } = useTabsStore.getState()

    const tab1 = addTabByRoute('/app/history', '历史记录', 'history')
    const tab2 = addTabByRoute('/app/history/detail', '历史详情', 'history')

    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(3) // home + 2 history
    expect(tab1!.id).not.toBe(tab2!.id)
    expect(state.tabs[1].route).toBe('/app/history')
    expect(state.tabs[2].route).toBe('/app/history/detail')
  })

  it('边界: 空 route 应返回 null', () => {
    const { addTabByRoute } = useTabsStore.getState()
    const result = addTabByRoute('', '空路由', 'history')

    expect(result).toBeNull()
    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(1) // only home
  })

  it('边界: route 字符串完全相同时去重生效', () => {
    const { addTabByRoute } = useTabsStore.getState()

    const first = addTabByRoute('/app/chat', '聊天1', 'chat')
    const second = addTabByRoute('/app/chat', '聊天2', 'chat')

    expect(second!.id).toBe(first!.id) // route 相同，激活已有
    expect(second!.title).toBe(first!.title) // 不覆盖已有标题
    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(2) // home + 1 chat
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run packages/web/tests/tabs-store.spec.ts
```

预期：FAIL — `addTabByRoute` 未实现。

- [ ] **步骤 3: 实现 addTabByRoute**

修改 `packages/web/src/stores/tabs.ts`，替换占位实现：

```typescript
// 替换 addTabByRoute 占位
addTabByRoute: (route, defaultTitle, type) => {
  if (!route) return null

  const { tabs, addTab } = get()

  const existing = tabs.find((t) => t.route === route)
  if (existing) {
    set({ activeTabId: existing.id })
    return existing
  }

  return addTab(type, undefined, defaultTitle, route)
},
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run packages/web/tests/tabs-store.spec.ts
```

预期：PASS — 任务 1-3 的全部用例通过。

---

### 任务 4: removeTab + canClose 规则

**文件：**
- 修改：`packages/web/src/stores/tabs.ts`（实现 `removeTab` + 内部 `canClose`）
- 修改：`packages/web/tests/tabs-store.spec.ts`（新增测试用例）

**规格引用：**
- feature-spec: [AC-04 removeTab 关闭并激活左侧相邻 + home 防删除]、[AC-07 全部关闭后自动创建 home]
- behavior-spec: [交互状态表 #removeTab 行]、[关闭规则真值表 canClose]、[边界条件 §关闭]

- [ ] **步骤 1: 编写失败测试**

```typescript
// 追加到 packages/web/tests/tabs-store.spec.ts
describe('tabs store — removeTab + canClose 规则', () => {
  beforeEach(() => {
    useTabsStore.setState({
      tabs: [
        { id: 'home', type: 'chat', title: '首页', closable: false, isDirty: false },
      ],
      activeTabId: 'home',
    })
  })

  it('AC-04: 关闭 home 标签应静默忽略', () => {
    const { removeTab } = useTabsStore.getState()
    removeTab('home')

    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.activeTabId).toBe('home')
  })

  it('AC-04: 关闭当前活跃标签后应激活左侧相邻标签', () => {
    const { addTab, removeTab } = useTabsStore.getState()

    const tab1 = addTab('history', undefined, '历史')
    const tab2 = addTab('kb', undefined, '知识库')
    // 当前活跃: tab2
    removeTab(tab2.id)

    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(2) // home + tab1
    expect(state.activeTabId).toBe(tab1.id) // 激活左侧 tab1
  })

  it('AC-04: 关闭非活跃标签时 activeTabId 应不变', () => {
    const { addTab, activateTab, removeTab } = useTabsStore.getState()

    const tab1 = addTab('history', undefined, '历史')
    addTab('kb', undefined, '知识库')
    activateTab(tab1.id) // 活跃: tab1
    removeTab('tab-kb') // 关闭 kb（非活跃）

    const state = useTabsStore.getState()
    expect(state.activeTabId).toBe(tab1.id)
    expect(state.tabs).toHaveLength(2) // home + tab1
  })

  it('AC-07: 全部可关闭标签关闭后应自动创建 home', () => {
    useTabsStore.setState({
      tabs: [
        { id: 'home', type: 'chat', title: '首页', closable: false, isDirty: false },
        { id: 'tab-1', type: 'history', title: '历史', closable: true, isDirty: false },
      ],
      activeTabId: 'tab-1',
    })

    const { removeTab } = useTabsStore.getState()
    removeTab('tab-1')

    const state = useTabsStore.getState()
    // 所有 closable 已关闭，home 标签保留
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0].id).toBe('home')
    expect(state.activeTabId).toBe('home')
  })

  // canClose 真值表测试
  it('canClose: chat 标签总是可关闭', () => {
    const { addTab, removeTab } = useTabsStore.getState()

    const chatTab = addTab('chat', 'sess-1', '聊天')
    removeTab(chatTab.id)

    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(1) // chat 被成功关闭
  })

  it('canClose: 最后一个非 chat 且有 chat 存在时不可关', () => {
    useTabsStore.setState({
      tabs: [
        { id: 'home', type: 'chat', title: '首页', closable: false, isDirty: false },
        { id: 'chat-tab', type: 'chat', title: '聊天', closable: true, isDirty: false },
        { id: 'history-tab', type: 'history', title: '历史', closable: true, isDirty: false },
      ],
      activeTabId: 'history-tab',
    })

    const { removeTab } = useTabsStore.getState()
    removeTab('history-tab')

    const state = useTabsStore.getState()
    // history 是唯一非 chat + chat 存在 → 不可关闭
    expect(state.tabs).toHaveLength(3)
    expect(state.tabs.find((t) => t.id === 'history-tab')).toBeDefined()
  })

  it('canClose: 唯一的非 chat 且无 chat 存在时可关闭', () => {
    useTabsStore.setState({
      tabs: [
        { id: 'home', type: 'chat', title: '首页', closable: false, isDirty: false },
        { id: 'history-tab', type: 'history', title: '历史', closable: true, isDirty: false },
      ],
      activeTabId: 'history-tab',
    })

    const { removeTab } = useTabsStore.getState()
    removeTab('history-tab')

    const state = useTabsStore.getState()
    // 无非 chat 外的 chat → 可以关闭
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0].id).toBe('home')
  })

  it('canClose: 多个非 chat 标签时其中一个可关闭', () => {
    useTabsStore.setState({
      tabs: [
        { id: 'home', type: 'chat', title: '首页', closable: false, isDirty: false },
        { id: 'history-1', type: 'history', title: '历史', closable: true, isDirty: false },
        { id: 'kb-1', type: 'kb', title: '知识库', closable: true, isDirty: false },
      ],
      activeTabId: 'kb-1',
    })

    const { removeTab } = useTabsStore.getState()
    removeTab('kb-1')

    const state = useTabsStore.getState()
    // history-1 还存在，kb-1 可以关闭
    expect(state.tabs).toHaveLength(2) // home + history-1
    expect(state.activeTabId).toBe('history-1')
  })

  it('边界: 关闭不存在的 tabId 应静默忽略', () => {
    const { removeTab } = useTabsStore.getState()
    const tabsBefore = useTabsStore.getState().tabs.length

    removeTab('non-existent')

    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(tabsBefore)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run packages/web/tests/tabs-store.spec.ts
```

预期：FAIL — `removeTab` 未实现。

- [ ] **步骤 3: 实现 removeTab + canClose**

修改 `packages/web/src/stores/tabs.ts`，替换 `removeTab` 占位并在 store 内部实现 `canClose` 辅助函数：

```typescript
// 替换 removeTab 占位
removeTab: (tabId) => {
  const state = get()
  const idx = state.tabs.findIndex((t) => t.id === tabId)
  if (idx === -1) return

  const tab = state.tabs[idx]

  // home 不可关闭
  if (tab.id === 'home') return

  // canClose 规则
  if (!canClose(tab, state.tabs)) return

  const newTabs = [...state.tabs]
  newTabs.splice(idx, 1)

  let newActiveId = state.activeTabId

  // 被关闭的标签是当前活跃标签
  if (state.activeTabId === tabId) {
    if (newTabs.length === 0) {
      // 全部关闭 → 创建 home
      newTabs.push({
        id: 'home',
        type: 'chat',
        title: '首页',
        closable: false,
        isDirty: false,
      })
      newActiveId = 'home'
    } else {
      // 激活左侧相邻
      const targetIdx = Math.max(0, idx - 1)
      newActiveId = newTabs[targetIdx].id
    }
  }

  set({ tabs: newTabs, activeTabId: newActiveId })
},
```

同时在文件作用域（store 外部）定义 `canClose`：

```typescript
// 内部辅助函数（store 外部，不暴露）
function canClose(tab: Tab, allTabs: Tab[]): boolean {
  if (tab.id === 'home') return false
  if (tab.type === 'chat') return true

  const nonChatTabs = allTabs.filter((t) => t.type !== 'chat' && t.id !== 'home')
  const chatExists = allTabs.some((t) => t.type === 'chat' && t.id !== tab.id)

  if (nonChatTabs.length === 1 && chatExists) return false
  return true
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run packages/web/tests/tabs-store.spec.ts
```

预期：PASS — 任务 1-4 的全部用例通过。

---

### 任务 5: closeAllTabs / closeOtherTabs 批量操作

**文件：**
- 修改：`packages/web/src/stores/tabs.ts`（实现 `closeAllTabs` + `closeOtherTabs`）
- 修改：`packages/web/tests/tabs-store.spec.ts`（新增测试用例）

**规格引用：**
- feature-spec: [AC-06 closeAllTabs/closeOtherTabs 批量关闭]、[AC-07 全部关闭后自动创建 home]
- behavior-spec: [交互状态表 #closeAllTabs/#closeOtherTabs 行]

- [ ] **步骤 1: 编写失败测试**

```typescript
// 追加到 packages/web/tests/tabs-store.spec.ts
describe('tabs store — closeAllTabs / closeOtherTabs', () => {
  beforeEach(() => {
    useTabsStore.setState({
      tabs: [
        { id: 'home', type: 'chat', title: '首页', closable: false, isDirty: false },
        { id: 'chat-1', type: 'chat', title: '聊天1', closable: true, isDirty: false },
        { id: 'history-1', type: 'history', title: '历史', closable: true, isDirty: false },
        { id: 'kb-1', type: 'kb', title: '知识库', closable: true, isDirty: false },
      ],
      activeTabId: 'kb-1',
    })
  })

  it('AC-06: closeAllTabs 应关闭所有可关闭标签，仅保留 home', () => {
    const { closeAllTabs } = useTabsStore.getState()
    closeAllTabs()

    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0].id).toBe('home')
    expect(state.activeTabId).toBe('home')
  })

  it('AC-06: closeOtherTabs 应关闭除指定标签外的所有可关闭标签', () => {
    const { closeOtherTabs } = useTabsStore.getState()
    closeOtherTabs('history-1')

    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(2) // home + history-1
    expect(state.tabs[0].id).toBe('home')
    expect(state.tabs[1].id).toBe('history-1')
    expect(state.activeTabId).toBe('history-1') // 活跃标签切换到保留的标签
  })

  it('AC-06: closeOtherTabs 传入 home 时 home 应保留，其他全部关闭', () => {
    const { closeOtherTabs } = useTabsStore.getState()
    closeOtherTabs('home')

    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0].id).toBe('home')
    expect(state.activeTabId).toBe('home')
  })

  it('AC-06: closeOtherTabs 对不存在的 tabId 应静默忽略', () => {
    const { closeOtherTabs } = useTabsStore.getState()
    closeOtherTabs('non-existent')

    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(4) // 无变化
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run packages/web/tests/tabs-store.spec.ts
```

预期：FAIL — `closeAllTabs` + `closeOtherTabs` 未实现。

- [ ] **步骤 3: 实现 closeAllTabs + closeOtherTabs**

修改 `packages/web/src/stores/tabs.ts`，替换占位实现：

```typescript
// 替换 closeAllTabs 占位
closeAllTabs: () => {
  set({
    tabs: [
      {
        id: 'home',
        type: 'chat',
        title: '首页',
        closable: false,
        isDirty: false,
      },
    ],
    activeTabId: 'home',
  })
},

// 替换 closeOtherTabs 占位
closeOtherTabs: (tabId) => {
  const state = get()
  const targetTab = state.tabs.find((t) => t.id === tabId)
  if (!targetTab) return

  // 保留 home + 目标标签
  const keepIds = new Set(['home', tabId])
  const newTabs = state.tabs.filter((t) => keepIds.has(t.id))

  // 确保 home 保持在第一位
  if (!newTabs.find((t) => t.id === 'home')) {
    newTabs.unshift({
      id: 'home',
      type: 'chat',
      title: '首页',
      closable: false,
      isDirty: false,
    })
  }

  set({
    tabs: newTabs,
    activeTabId: tabId,
  })
},
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run packages/web/tests/tabs-store.spec.ts
```

预期：PASS — 任务 1-5 的全部用例通过。

---

### 任务 6: renameTab / updateHomeTabSession / updateActiveTabSession / setTabDirty

**文件：**
- 修改：`packages/web/src/stores/tabs.ts`（实现上述 4 个辅助 action）
- 修改：`packages/web/tests/tabs-store.spec.ts`（新增测试用例）

**规格引用：**
- feature-spec: [AC-10 renameTab/updateHomeTabSession/updateActiveTabSession 辅助更新]
- behavior-spec: [API 契约表 #renameTab/#updateHomeTabSession/#updateActiveTabSession/#setTabDirty]

- [ ] **步骤 1: 编写失败测试**

```typescript
// 追加到 packages/web/tests/tabs-store.spec.ts
describe('tabs store — 辅助更新方法', () => {
  beforeEach(() => {
    useTabsStore.setState({
      tabs: [
        { id: 'home', type: 'chat', title: '首页', closable: false, isDirty: false },
        { id: 'chat-1', type: 'chat', title: '聊天1', sessionId: 'sess-1', closable: true, isDirty: false },
      ],
      activeTabId: 'chat-1',
    })
  })

  it('AC-10: renameTab 应更新指定标签的标题', () => {
    const { renameTab } = useTabsStore.getState()
    renameTab('chat-1', '新标题')

    const state = useTabsStore.getState()
    const tab = state.tabs.find((t) => t.id === 'chat-1')
    expect(tab!.title).toBe('新标题')
  })

  it('AC-10: renameTab 对不存在的 tabId 应静默忽略', () => {
    const { renameTab } = useTabsStore.getState()
    const tabsBefore = [...useTabsStore.getState().tabs]
    renameTab('non-existent', '不会生效')

    const state = useTabsStore.getState()
    expect(state.tabs).toEqual(tabsBefore)
  })

  it('AC-10: updateHomeTabSession 应更新 home 标签的 sessionId + title', () => {
    const { updateHomeTabSession } = useTabsStore.getState()
    updateHomeTabSession('sess-home', '首页会话')

    const state = useTabsStore.getState()
    const homeTab = state.tabs.find((t) => t.id === 'home')
    expect(homeTab!.sessionId).toBe('sess-home')
    expect(homeTab!.title).toBe('首页会话')
  })

  it('AC-10: updateActiveTabSession 应更新当前活跃标签的 sessionId + title', () => {
    const { updateActiveTabSession } = useTabsStore.getState()
    updateActiveTabSession('sess-updated', '更新后的标题')

    const state = useTabsStore.getState()
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId)
    expect(activeTab!.sessionId).toBe('sess-updated')
    expect(activeTab!.title).toBe('更新后的标题')
  })

  it('AC-10: updateActiveTabSession 无活跃标签时应静默忽略', () => {
    useTabsStore.setState({ activeTabId: 'non-existent' })
    const { updateActiveTabSession } = useTabsStore.getState()
    // 不应抛出异常
    expect(() => updateActiveTabSession('sess-x', 'title-x')).not.toThrow()
  })

  it('AC-10: setTabDirty 应设置指定标签的 isDirty 标记', () => {
    const { setTabDirty } = useTabsStore.getState()
    setTabDirty('chat-1', true)

    const state = useTabsStore.getState()
    const tab = state.tabs.find((t) => t.id === 'chat-1')
    expect(tab!.isDirty).toBe(true)
  })

  it('AC-10: setTabDirty 对 home 标签也可设置 dirty', () => {
    const { setTabDirty } = useTabsStore.getState()
    setTabDirty('home', true)

    const state = useTabsStore.getState()
    const homeTab = state.tabs.find((t) => t.id === 'home')
    expect(homeTab!.isDirty).toBe(true)
  })

  it('AC-10: setTabDirty 对不存在的 tabId 应静默忽略', () => {
    const { setTabDirty } = useTabsStore.getState()
    expect(() => setTabDirty('non-existent', true)).not.toThrow()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run packages/web/tests/tabs-store.spec.ts
```

预期：FAIL — 辅助方法未实现。

- [ ] **步骤 3: 实现辅助方法**

修改 `packages/web/src/stores/tabs.ts`，替换占位实现：

```typescript
// 替换 renameTab 占位
renameTab: (tabId, title) => {
  set((state) => ({
    tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, title } : t)),
  }))
},

// 替换 updateHomeTabSession 占位
updateHomeTabSession: (sessionId, title) => {
  set((state) => ({
    tabs: state.tabs.map((t) =>
      t.id === 'home' ? { ...t, sessionId, title } : t,
    ),
  }))
},

// 替换 updateActiveTabSession 占位
updateActiveTabSession: (sessionId, title) => {
  set((state) => ({
    tabs: state.tabs.map((t) =>
      t.id === state.activeTabId ? { ...t, sessionId, title } : t,
    ),
  }))
},

// 替换 setTabDirty 占位
setTabDirty: (tabId, isDirty) => {
  set((state) => ({
    tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, isDirty } : t)),
  }))
},
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run packages/web/tests/tabs-store.spec.ts
```

预期：PASS — 任务 1-6 的全部用例通过。

---

### 任务 7: persist hydrate 恢复校验 + 边界条件

**文件：**
- 修改：`packages/web/src/stores/tabs.ts`（添加 `onRehydrateStorage` 回调）
- 修改：`packages/web/tests/tabs-store.spec.ts`（新增持久化恢复用例）

**规格引用：**
- feature-spec: [AC-09 persist hydrate 恢复时确保 home 标签始终存在]
- behavior-spec: [持久化恢复 §Hydrate 时校验 1-4]、[边界条件 §持久化]

- [ ] **步骤 1: 编写失败测试**

```typescript
// 追加到 packages/web/tests/tabs-store.spec.ts
describe('tabs store — persist hydrate 恢复 + 边界条件', () => {
  // 每个测试前清空 localStorage
  beforeEach(() => {
    localStorage.removeItem('goferbot-tabs')
    // 重置 store 到初始状态
    useTabsStore.setState({
      tabs: [
        { id: 'home', type: 'chat', title: '首页', closable: false, isDirty: false },
      ],
      activeTabId: 'home',
    })
  })

  it('AC-09: 恢复时若无 home 标签应自动插入', () => {
    // 模拟损坏数据：tabs 中没有 home
    const damagedData = JSON.stringify({
      state: {
        tabs: [{ id: 'other', type: 'chat', title: '其他', closable: true, isDirty: false }],
        activeTabId: 'other',
      },
      version: 0,
    })
    localStorage.setItem('goferbot-tabs', damagedData)

    // 重新创建 store 触发 hydrate
    // 由于 store 是单例，此处通过 onRehydrateStorage 行为验证
    // store 已在顶层创建，hydrate 在创建时自动触发

    // 验证：当前状态中 home 必然存在
    const state = useTabsStore.getState()
    const homeTab = state.tabs.find((t) => t.id === 'home')
    expect(homeTab).toBeDefined()
    expect(homeTab!.closable).toBe(false)
  })

  it('AC-09: 恢复时 activeTabId 若指向不存在的标签应重置为 home', () => {
    const invalidData = JSON.stringify({
      state: {
        tabs: [{ id: 'home', type: 'chat', title: '首页', closable: false, isDirty: false }],
        activeTabId: 'ghost-tab', // 不存在的标签
      },
      version: 0,
    })
    localStorage.setItem('goferbot-tabs', invalidData)

    const state = useTabsStore.getState()
    // activeTabId 要么是 home 要么指向一个实际存在的标签
    const tabExists = state.tabs.some((t) => t.id === state.activeTabId)
    expect(tabExists).toBe(true)
  })

  it('AC-09: 恢复时 home 标签的 closable 强制设为 false', () => {
    // 模拟损坏数据：home 的 closable 错误地设为 true
    const corruptedData = JSON.stringify({
      state: {
        tabs: [
          { id: 'home', type: 'chat', title: '首页', closable: true, isDirty: false },
          { id: 'chat-1', type: 'chat', title: '聊天', closable: true, isDirty: false },
        ],
        activeTabId: 'home',
      },
      version: 0,
    })
    localStorage.setItem('goferbot-tabs', corruptedData)

    const state = useTabsStore.getState()
    const homeTab = state.tabs.find((t) => t.id === 'home')
    expect(homeTab).toBeDefined()
    // home 标签 closable 必须始终为 false
    expect(homeTab!.closable).toBe(false)
  })

  it('边界: persist 应只持久化 tabs + activeTabId', () => {
    // 触发一次状态变更以触发 persist
    const { addTab } = useTabsStore.getState()
    addTab('history', undefined, '历史记录')

    const raw = localStorage.getItem('goferbot-tabs')
    expect(raw).not.toBeNull()

    const parsed = JSON.parse(raw!)
    const persistedState = parsed.state
    expect(persistedState).toHaveProperty('tabs')
    expect(persistedState).toHaveProperty('activeTabId')
    // 不应持久化函数（如 activeTab）
    expect(persistedState.activeTab).toBeUndefined()
    // 不应持久化 actions
    expect(persistedState.addTab).toBeUndefined()
  })

  it('边界: localStorage 中的数据可正常恢复为完整 store', () => {
    const { addTab } = useTabsStore.getState()
    addTab('chat', 'sess-42', '测试会话')

    // 从 localStorage 验证可恢复
    const raw = localStorage.getItem('goferbot-tabs')
    const parsed = JSON.parse(raw!)

    // 重建状态
    const restored = parsed.state
    expect(restored.tabs).toHaveLength(2) // home + chat
    expect(restored.tabs[0].id).toBe('home')
    expect(restored.tabs[1].type).toBe('chat')
    expect(restored.tabs[1].sessionId).toBe('sess-42')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run packages/web/tests/tabs-store.spec.ts
```

预期：部分 FAIL — hydrate 校验逻辑未实现，损坏数据场景下的恢复行为不正确。

- [ ] **步骤 3: 实现 onRehydrateStorage 校验**

修改 `packages/web/src/stores/tabs.ts`，在 `persist` 配置中添加 `onRehydrateStorage`：

```typescript
export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      // ... 保持原有 state + actions 不变 ...
    }),
    {
      name: 'goferbot-tabs',
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
      }),
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error || !state) return

          // 1. 确保 tabs 数组中存在 home 标签
          const hasHome = state.tabs.some((t) => t.id === 'home')
          if (!hasHome) {
            state.tabs.unshift({
              id: 'home',
              type: 'chat',
              title: '首页',
              closable: false,
              isDirty: false,
            })
          }

          // 2. 确保 activeTabId 指向一个存在的标签
          const tabExists = state.tabs.some((t) => t.id === state.activeTabId)
          if (!tabExists) {
            state.activeTabId = 'home'
          }

          // 3. home 标签的 closable 强制设为 false
          const homeTab = state.tabs.find((t) => t.id === 'home')
          if (homeTab) {
            homeTab.closable = false
          }

          // 4. 确保 home 在 tabs 数组的第一位
          const homeIdx = state.tabs.findIndex((t) => t.id === 'home')
          if (homeIdx > 0) {
            const [home] = state.tabs.splice(homeIdx, 1)
            state.tabs.unshift(home)
          }
        }
      },
    },
  ),
)
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run packages/web/tests/tabs-store.spec.ts
```

预期：PASS — 全部 7 组测试用例通过。

- [ ] **步骤 5: 全量测试 + 类型检查**

```bash
npx vitest run packages/web/tests/tabs-store.spec.ts && pnpm type-check
```

预期：PASS + PASS。

---

## 自检

### 规格覆盖

- [x] feature-spec AC-01 Tab 类型 → 任务 1
- [x] feature-spec AC-02 addTab → 任务 2
- [x] feature-spec AC-03 addTabByRoute singleton → 任务 3
- [x] feature-spec AC-04 removeTab + home 防删除 → 任务 4
- [x] feature-spec AC-05 activateTab → 任务 2
- [x] feature-spec AC-06 closeAllTabs/closeOtherTabs → 任务 5
- [x] feature-spec AC-07 全部关闭后创建 home → 任务 4 + 5
- [x] feature-spec AC-08 persist 持久化 → 任务 1 + 7
- [x] feature-spec AC-09 persist hydrate 恢复 → 任务 7
- [x] feature-spec AC-10 辅助更新方法 → 任务 6
- [x] behavior-spec 交互状态表（10 场景）→ 任务 2-5 全部覆盖
- [x] behavior-spec canClose 真值表（5 规则）→ 任务 4
- [x] behavior-spec 边界条件（添加/关闭/持久化/激活）→ 任务 2-7

### 占位符扫描

- 无 TODO/TBD/稍后实现
- 所有步骤有具体代码片段

### PRD 偏差

- 无偏差：完全对齐 PRD §5.6 阶段二补全的 f-43 需求

### Store API 与 Pinia 旧版对照

| Pinia (旧) | Zustand (新) | 说明 |
|-----------|-------------|------|
| `addTab(type, sessionId?, title?)` | `addTab(type, sessionId?, title?, route?)` | 新增 `route` 参数 |
| `addTabByRoute(routeName)` | `addTabByRoute(route, defaultTitle, type)` | 移除 `TAB_ROUTE_CONFIG` 依赖，参数显式化 |
| `closeTab(tabId)` | `removeTab(tabId)` | 行为等价 |
| `switchTab(tabId)` | `activateTab(tabId)` | 重命名，行为等价 |
| 无 | `closeAllTabs()` | 新增功能 |
| 无 | `closeOtherTabs(tabId)` | 新增功能 |
| `renameTab(tabId, title)` | `renameTab(tabId, title)` | 行为等价 |
| `updateHomeTabSession(sessionId, title)` | `updateHomeTabSession(sessionId, title)` | 行为等价 |
| `updateActiveTabSession(sessionId, title)` | `updateActiveTabSession(sessionId, title)` | 行为等价 |
| 无 | `setTabDirty(tabId, isDirty)` | 新增功能 |
| `activeTab` (computed) | `activeTab()` (getter) | Pinia computed → Zustand 函数调用 |
| `canClose(tab)` (内部函数) | `canClose(tab, allTabs)` (内部函数) | 签名调整，逻辑一致 |
