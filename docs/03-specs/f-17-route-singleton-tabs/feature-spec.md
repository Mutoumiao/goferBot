# 功能规格：路由单例标记

## 用户故事
作为开发者，我希望 Tab 的单例/多重行为由路由元数据驱动而非 Store 硬编码，以便新增页面时只需配置路由 meta 即可定义标签行为。

## 边界
- 范围内：
  - 路由配置添加 `meta.singleton` 字段
  - knowledgeBase / history / settings / recycleBin 标记 `singleton: true`
  - chat 标记 `singleton: false`
  - Tab Store 的 `addTab` 读取路由 meta 决定去重
  - AppSidebar 导航从 `router.push` 改为 tab 操作
- 范围外：
  - 标签持久化
  - 标签拖拽排序

## 涉及页面/组件
- `packages/webui/src/router/index.ts` — 添加 meta.singleton
- `packages/webui/src/stores/tabs.ts` — addTab 读取路由配置
- `packages/webui/src/components/layout/AppSidebar.vue` — 导航适配

## 相关功能
- f-15-global-tab-bar — 提供全局 TabBar 架构（上游依赖）
- f-16-unified-tab-types — 提供统一 Tab Store（上游依赖）

## 路由 meta 扩展

```typescript
// router/index.ts 路由 meta 类型扩展
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    singleton?: boolean    // 新增：标签是否单例
    tabType?: TabType      // 新增：对应的标签类型
  }
}
```

## 已做决策
| 决策 | 理由 | 可逆？ |
|------|------|--------|
| singleton 由路由 meta 驱动而非 Store 硬编码 | 新增页面时只需改路由配置，符合"配置优于代码" | 否 |
| `tabType` 也放 meta 中 | 侧边栏点击时可直接从路由取 tabType，无需维护映射表 | 否 |
| AppSidebar 通过 tabsStore 操作而非 router.push | 全局标签栏架构下，导航等价于标签操作 | 否 |
