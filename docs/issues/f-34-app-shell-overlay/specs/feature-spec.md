# 功能规格：App Shell 布局与 Overlay 系统迁移

> 状态：draft | 关联 issue：f-34 | PRD：docs/prd/v3-frontend-migration.md §5.2 + §6.3

---

## 1. 目标

迁移 App Shell（AuthenticatedLayout + Sidebar + TabBar）+ Overlay 系统（React Portal + Zustand、命令式 openDialog/openContextMenu），建立应用框架骨架和弹窗基础设施。

---

## 2. 功能描述

### 2.1 根路由（__root.tsx）

全局 HTML 骨架，包含 `<html>`、`<head>`（HeadContent）、`<body>`（Outlet + Scripts + OverlayHost）。

### 2.2 App Shell 布局（/app/route.tsx）

| 区域 | 组件 | 说明 |
|------|------|------|
| 左侧 | Sidebar | 会话列表、知识库入口、设置入口 |
| 顶部 | TabBar | 当前打开页签切换 |
| 中间 | `<Outlet />` | 页面内容渲染区 |

### 2.3 Overlay 系统

**核心 API**：
- `openDialog(Component, props)` — 打开弹窗，返回 Promise
- `closeDialog(id)` — 关闭指定弹窗
- `closeAllDialogs()` — 关闭所有弹窗
- `openContextMenu(Component, props, position: {x, y})` — 打开右键菜单
- `closeContextMenu(id)` — 关闭菜单

**架构**：
```
Zustand Overlay Store (队列 + z-index)
    ↓
OverlayHost (createPortal → document.body)
    ↓
Dialog/ContextMenu 实例渲染
```

### 2.4 Zustand Overlay Store

```typescript
interface OverlayItem {
  id: string
  component: ComponentType
  props: Record<string, any>
  zIndex: number
  resolve?: (result: any) => void
  reject?: (reason: any) => void
}

interface OverlayStore {
  dialogs: OverlayItem[]
  contextMenus: OverlayItem[]
  openDialog: (component, props) => Promise<any>
  closeDialog: (id: string) => void
  closeAllDialogs: () => void
  openContextMenu: (component, props, position) => void
  closeContextMenu: (id: string) => void
}
```

---

## 3. 目录结构

```
app/
├── routes/
│   ├── __root.tsx              # 全局根路由（含 OverlayHost）
│   └── app/
│       └── route.tsx           # /app 布局路由 + beforeLoad 守卫
├── components/
│   ├── sidebar/
│   │   └── Sidebar.tsx         # 侧边栏骨架（业务逻辑由 f-37 补全）
│   └── tab-bar/
│       └── TabBar.tsx          # 页签栏骨架
└── overlays/
    ├── host/
    │   ├── OverlayHost.tsx     # Portal 渲染宿主
    │   └── overlay-store.ts    # Zustand Store
    ├── services/
    │   └── overlay-service.ts  # openDialog/openContextMenu
    ├── hooks/
    │   └── useOverlay.ts       # useDialog/useContextMenu hooks
    └── types/
        └── overlay.types.ts    # 泛型类型约束
```

---

## 4. 验收标准映射

| AC | 验收项 |
|----|--------|
| AC-01 | __root.tsx 正确渲染 |
| AC-02 | beforeLoad 鉴权守卫生效 |
| AC-03 | Sidebar + TabBar + Outlet 布局 |
| AC-04 | Overlay 目录结构完整 |
| AC-05 | Zustand Overlay Store 队列/z-index/closeAll |
| AC-06 | OverlayHost 通过 createPortal 渲染 |
| AC-07 | openDialog/closeDialog 命令式调用 |
| AC-08 | openContextMenu 右键跟随位置 |
