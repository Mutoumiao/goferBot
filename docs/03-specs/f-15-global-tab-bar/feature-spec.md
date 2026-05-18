# 功能规格：全局标签栏

## 用户故事
作为用户，我希望标签栏在页面顶部全局可见，所有页面（对话/知识库/历史/设置/回收站）以标签形式打开，对话页面可多开，以便在多个会话和其他功能间快速切换而不丢失上下文。

## 边界
- 范围内：
  - AuthenticatedLayout 插入 header 区域承载 TabBar
  - TabBar 从 ChatView 移除，迁入 Layout header
  - 侧边栏点击 → 打开/激活对应类型标签
  - 标签驱动 `<RouterView>` 内容切换
  - Chat 类型标签多开，其他类型单例
  - 标签关闭、切换、新建交互逻辑
  - home 标签（无对话）始终存在且不可关闭
- 范围外：
  - 标签拖拽排序
  - 标签右键菜单
  - 标签持久化存储
  - 路由元数据 singleton 标记（f-17 负责）

## 涉及页面/组件
- `packages/webui/src/layouts/AuthenticatedLayout.vue` — 插入 header + TabBar
- `packages/webui/src/views/ChatView.vue` — 移除内部 TabBar
- `packages/webui/src/components/TabBar.vue` — 迁入 `components/layout/`
- `packages/webui/src/components/layout/AppSidebar.vue` — 导航逻辑从 router.push 改为 tab 操作

## 相关功能
- f-16-unified-tab-types — 提供统一 Tab Store（上游依赖）
- f-17-route-singleton-tabs — 路由 meta 驱动单例（下游消费）
- f-03-sidebar-navigation（已关闭） — 侧边栏导航适配

## 布局结构（目标）

```
AuthenticatedLayout
├── AppSidebar（固定左侧）
└── 主内容区
    ├── Header（38px，固定顶部）
    │   └── TabBar
    └── <RouterView>（由 activeTab 驱动）
```

## 已做决策
| 决策 | 理由 | 可逆？ |
|------|------|--------|
| TabBar 放 header 而非 main 内部 | 全局导航 UI 应与内容区分离，类似浏览器标签栏 | 否 |
| RouterView 由 activeTab.type 驱动内容切换 | 保持 Vue Router 参与 URL 同步，但不直接驱动导航 | 否 |
| 非 chat 标签单例逻辑放在 f-16 Store 内 | locality：去重逻辑集中在 Store，调用方无需关心 | 是 |
| home 标签 type='chat' 但 sessionId=null | 语义上 home 是"未关联会话的对话入口"，属 chat 大类 | 是 |
