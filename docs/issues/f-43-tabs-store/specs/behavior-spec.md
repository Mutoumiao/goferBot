---
issue: f-43
type: behavior-spec
status: draft
---

# f-43 Tabs Store 行为规格

## 标签生命周期状态机

```
  [home 标签常驻] (id='home', closable=false)
       │
       ├── addTab('chat') ──▶ [新标签追加, 激活]
       │
       ├── addTabByRoute('/app/history') ──▶ [检查是否有同 route 标签]
       │       ├── 有 → 激活已有标签（不创建）
       │       └── 无 → 创建新标签 + 激活
       │
       ├── removeTab(id) ──▶ [关闭规则检查]
       │       ├── id === 'home' → 无操作
       │       ├── canClose(tab) === false → 无操作
       │       └── canClose(tab) === true → splice 移除
       │               ├── activeTabId === 被关ID → 激活左侧相邻
       │               │       └── 无相邻（全部关闭）→ 创建 home 标签
       │               └── activeTabId !== 被关ID → 不变
       │
       └── closeAllTabs() ──▶ 关闭所有 closable 标签 → 创建 home
```

## 交互状态表

| 操作 | 输入 | 前置条件 | 后置条件 |
|------|------|---------|---------|
| **addTab** | type='chat' | tabs=[home] | tabs=[home, chatTab], activeTabId=chatTab.id |
| **addTab** | type='history' | tabs=[home] | tabs=[home, historyTab], activeTabId=historyTab.id |
| **addTabByRoute** | route='/app/history' | tabs=[home], 无 history 标签 | 创建 history 标签并激活 |
| **addTabByRoute** | route='/app/history' | tabs=[home, historyTab], history 标签已存在 | 激活已有 historyTab，不创建 |
| **removeTab** | tabId=chatTab.id | activeTabId=chatTab.id, tabs=[home, chatTab] | tabs=[home], activeTabId='home' |
| **removeTab** | tabId='home' | tabs=[home, chatTab] | 无变化（home 不可关） |
| **removeTab** | tabId=chatTab.id | activeTabId='home', tabs=[home, chatTab, kbTab] | tabs=[home, kbTab], activeTabId='home' |
| **closeAllTabs** | — | tabs=[home, chatTab, kbTab] | tabs=[home], activeTabId='home' |
| **closeOtherTabs** | tabId=chatTab.id | tabs=[home, chatTab, kbTab] | tabs=[home, chatTab], activeTabId=chatTab.id |
| **activateTab** | tabId=kbTab.id | tabs=[home, chatTab, kbTab] | activeTabId=kbTab.id |

## 关闭规则真值表 (canClose)

| tab.id | tab.type | tabs 中有 chat | tabs 中非 chat 数量(不含 home) | 结果 | 原因 |
|--------|----------|---------------|------------------------------|------|------|
| 'home' | any | any | any | **false** | home 永远不可关闭 |
| X | 'chat' | — | — | **true** | chat 标签总是可关闭 |
| X | 'history' | 无 | 1 | **true** | 唯一的非 chat，无 chat 存在 |
| X | 'history' | 有 | 1 | **false** | 最后一个非 chat，且有 chat 存在 |
| X | 'history' | 有 | ≥2 | **true** | 还有其他非 chat 标签 |

## 持久化恢复

### Persist 配置

```typescript
persist(
  (set, get) => ({ /* state + actions */ }),
  {
    name: 'goferbot-tabs',
    partialize: (state) => ({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
    }),
  }
)
```

### Hydrate 时校验

```
onRehydrateStorage 回调:
1. 确保 tabs 数组中存在 home 标签（id='home'）
2. 如果 home 不存在，在数组头部插入 home
3. 确保 activeTabId 指向一个存在的标签，否则指向 'home'
4. home 标签的 closable 强制设为 false
```

## 边界条件

### 添加
- **重复 type 但不同 route**：`addTabByRoute` 按 route 去重，type 相同但 route 不同的标签可以共存
- **空 title**：使用默认标题（type 作为 fallback）
- **空 route 的标签**：`addTabByRoute` 对空 route 返回 null

### 关闭
- **关闭不存在的 tabId**：静默忽略
- **关闭 home**：静默忽略
- **关闭后无活跃标签**：自动创建 home 标签（id='home', type='chat', title='首页', closable=false）
- **并发关闭同一标签**：第二次调用时标签已不存在，静默忽略
- **关闭 dirty 标签**：store 不处理确认逻辑（由 UI 层先询问用户再调用 removeTab）

### 持久化
- **localStorage 数据损坏**：catch 异常，使用初始状态（仅 home 标签）
- **localStorage 不可用**：persist middleware 静默降级
- **恢复的 activeTabId 指向不存在的标签**：重置为 'home'

### 激活
- **activateTab 传入不存在的 tabId**：静默忽略，保持当前 activeTabId
