---
id: f-34
status: closed
track: frontend
priority: p0
summary: 迁移 App Shell（AuthenticatedLayout + Sidebar + TabBar）+ Overlay 系统（React Portal + Zustand、命令式 openDialog/openContextMenu），建立应用框架骨架和弹窗基础设施
blocked_by:
  - f-33
checklist: checklist.json
plan: plan.md
specs: specs/
prd: docs/prd/v3-frontend-migration.md
prd_section: §5.2 阶段二 + §6.3 Overlay 系统
---

## 要构建的内容

在鉴权链路就绪后，搭建 packages/web 的应用框架骨架：创建 `__root.tsx` 全局布局、`/app` 布局路由（AuthenticatedLayout — Sidebar + TabBar + `<Outlet />`）、迁移 Overlay 系统（React Portal + Zustand Store 替代 Vue Teleport + Provide/Inject，保持命令式 `openDialog()`/`openContextMenu()` 调用体验）。完成后用户登录后可看到完整的 App Shell，弹窗和右键菜单基础设施可用。

## 规格引用

- 功能规格: specs/feature-spec.md
- 行为规格: specs/behavior-spec.md

## PRD 引用

- **来源 PRD**: docs/prd/v3-frontend-migration.md
- **对应章节**: §5.2 阶段二：核心能力迁移（路由守卫、布局迁移、Overlay 迁移）+ §6.3 Overlay 系统
- **核心目标**: 复用命令式调用设计，保持相同的开发体验；React Portal 替代 Vue Teleport；Zustand Store 替代 Vue Provide/Inject
- **验收标准**: 登录后可看到完整的 App Shell（Sidebar + TabBar + 内容区）；Overlay 系统命令式调用可用（`openDialog(MyDialog, props)`）

## 验收标准

- [ ] `app/routes/__root.tsx` — 根路由，包含全局 `<HeadContent>` + `<Outlet>` + `<Scripts>`
- [ ] `app/routes/app/route.tsx` — `/app` 布局路由，`beforeLoad` 鉴权守卫，AuthenticatedLayout（Sidebar + TabBar + `<Outlet />`）
- [ ] Overlay 系统目录结构：`app/overlays/{dialogs,context-menus,host,services,hooks,types}/`
- [ ] Zustand Overlay Store — 管理 overlay 队列、z-index 层级、全局 `closeAll`
- [ ] React Portal — `OverlayHost` 组件通过 `createPortal` 渲染到 `document.body`
- [ ] `openDialog(Component, props)` / `closeDialog(id)` — 命令式调用，返回 Promise
- [ ] `openContextMenu(Component, props, position)` / `closeContextMenu(id)` — 右键菜单，跟随鼠标位置
- [ ] 调用体验与 Vue 版 `defineDialog`/`defineContextMenu` 一致

## 阻塞于

- f-33: 鉴权流程端到端迁移（需要 `/login` 页面 + auth Store + 路由守卫先就绪，App Shell 才有入口）

## 范围外

- 不创建具体的业务 Dialog/ContextMenu 组件（如 KB 选择器、设置弹窗等，属于各页面 issue）
- 不迁移 Sidebar/TabBar 的业务逻辑（如会话列表加载、Tab 切换逻辑等，属于 f-37）
- 不修改后端 API
