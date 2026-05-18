# 行为规格：路由单例标记

## 入口
- 侧边栏导航点击 → `tabsStore.addTabByRoute(routeName)`

## 初始状态
- 路由 meta 配置完成，所有 `/app/*` 路由具备 `singleton` 和 `tabType` 字段

## 交互状态

| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| loading | N/A（同步操作） | N/A | N/A |
| empty | N/A | N/A | N/A |
| error | N/A | N/A | N/A |
| success | 标签正确去重 | 点击侧边栏 | singleton 页面复用标签，chat 新建 |

## 正常流程

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 点击侧边栏"知识库"（首次） | `addTabByRoute('knowledgeBase')` → 查找路由 meta → singleton: true → 无已有标签 → 新建 | 知识库标签出现 |
| 2 | 切换到"对话"，再点"知识库" | `addTabByRoute('knowledgeBase')` → 已有同类型标签 → `switchTab` | 知识库标签激活，不新建 |
| 3 | 点击"对话" | `addTabByRoute('chat')` → singleton: false → 始终新建 | 新 chat 标签出现 |
| 4 | 点击"设置" | `addTabByRoute('settings')` → singleton: true → 新建 | 设置标签出现 |

## `addTabByRoute` 逻辑

```
addTabByRoute(routeName: string):
  route = router.getRoutes().find(r => r.name === routeName)
  if !route.meta.tabType → 不处理（非 tab 路由）
  
  if route.meta.singleton:
    existing = tabs.find(t => t.type === route.meta.tabType)
    if existing → switchTab(existing.id); return
  
  // 构建新标签
  tab = {
    id: generateId(),
    type: route.meta.tabType,
    title: routeDisplayName(routeName),
    closable: true
  }
  tabs.push(tab)
  activeTabId = tab.id
  router.push({ name: routeName })  // 同步 URL
```

## 路由配置变更

```typescript
// 变更前（router/index.ts）
{ path: 'knowledge-base', name: 'knowledgeBase', component: ... }

// 变更后
{ path: 'knowledge-base', name: 'knowledgeBase', component: ...,
  meta: { singleton: true, tabType: 'knowledgeBase' } }
```

| 路由 | singleton | tabType |
|------|-----------|---------|
| chat | false | 'chat' |
| knowledgeBase | true | 'knowledgeBase' |
| history | true | 'history' |
| settings | true | 'settings' |
| recycleBin | true | 'recycleBin' |

## 错误场景

| 场景 | 触发 | 视觉 | 恢复 |
|------|------|------|------|
| routeName 不存在 | 传入无效路由名 | 无变化，console.warn | 无需恢复 |
| route 无 tabType meta | 路由未配置 tab 元数据 | 无变化，跳过 | 补充路由 meta 配置 |
| RouterView 无匹配组件 | tabType 无对应路由 | 空白内容区 | 检查路由配置 |

## 响应式行为
无变化（纯逻辑层变更，不影响布局）
