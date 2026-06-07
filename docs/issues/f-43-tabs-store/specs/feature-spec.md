---
issue: f-43
type: feature-spec
status: draft
---

# f-43 Tabs Store 功能规格

## 用户故事

**作为** 前端开发者
**我需要** 一个管理标签页列表的 Zustand store，支持增删切换和持久化恢复
**以便** TabBar 组件能渲染标签栏、处理标签切换和关闭交互

## 功能边界

### 包含

- `Tab` 类型定义（id/title/route/icon/isDirty/closable）
- 标签 CRUD：`addTab` / `removeTab` / `activateTab` / `closeAllTabs` / `closeOtherTabs`
- `addTabByRoute` 带去重（singleton 标签）
- 关闭规则：home 不可关闭、最后一个非 chat 保护
- Zustand `persist` middleware 持久化到 localStorage key `goferbot-tabs`
- `renameTab` / `updateHomeTabSession` / `updateActiveTabSession` 辅助方法

### 不包括

- TabBar UI 组件实现
- 实际路由切换（由 TanStack Router 处理）
- `TAB_ROUTE_CONFIG` 依赖（旧 Vue router 概念，迁移时简化）

## 数据模型

```typescript
interface Tab {
  id: string            // 唯一标识
  type: string          // 标签类型：'chat' | 'history' | 'kb' | 'settings' | 'recycle-bin'
  title: string         // 显示标题
  route?: string        // 关联路由（用于 addTabByRoute 去重）
  icon?: string         // 图标名称
  sessionId?: string    // chat 类型关联的 session ID
  isDirty: boolean      // 是否有未保存内容（用于关闭确认）
  closable: boolean     // 是否可关闭（home 为 false）
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string

  // 派生
  activeTab: () => Tab | null

  // Actions
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
```

## API 契约

| 方法 | 签名 | 说明 |
|------|------|------|
| `addTab` | `(type, sessionId?, title?, route?) => Tab` | 直接添加标签，不做去重 |
| `addTabByRoute` | `(route, defaultTitle, type) => Tab \| null` | 通过路由添加标签，singleton 模式去重 |
| `removeTab` | `(tabId) => void` | 关闭标签，自动激活左侧相邻 |
| `activateTab` | `(tabId) => void` | 切换活跃标签 |
| `closeAllTabs` | `() => void` | 关闭所有可关闭标签，重置为 home |
| `closeOtherTabs` | `(tabId) => void` | 关闭除指定标签外的所有可关闭标签 |
| `renameTab` | `(tabId, title) => void` | 更新标签标题 |
| `updateHomeTabSession` | `(sessionId, title) => void` | 更新 home 标签的 session 信息 |
| `updateActiveTabSession` | `(sessionId, title) => void` | 更新当前活跃标签的 session 信息 |
| `setTabDirty` | `(tabId, isDirty) => void` | 设置标签 dirty 标记 |

## 验收标准映射

| AC | 描述 | 优先级 |
|----|------|--------|
| AC-01 | 定义 `Tab` 类型（id/title/route/icon/isDirty/closable） | p0 |
| AC-02 | `addTab` 添加标签到列表末尾并激活 | p0 |
| AC-03 | `addTabByRoute` 检查 singleton 去重（相同 route 的标签只保留一个） | p0 |
| AC-04 | `removeTab` 关闭标签 + 激活左侧相邻 + home 防删除 | p0 |
| AC-05 | `activateTab` 切换活跃标签 ID | p0 |
| AC-06 | `closeAllTabs` / `closeOtherTabs` 批量关闭 | p0 |
| AC-07 | 关闭规则：全部关闭后自动创建 home 标签 | p0 |
| AC-08 | Zustand `persist` middleware 持久化 tabs + activeTabId 到 localStorage | p0 |
| AC-09 | persist hydrate 恢复时确保 home 标签始终存在 | p0 |
| AC-10 | `renameTab` / `updateHomeTabSession` / `updateActiveTabSession` 辅助更新 | p1 |
