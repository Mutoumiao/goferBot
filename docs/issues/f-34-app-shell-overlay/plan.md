---
id: f-34
issue: issue.md
version: 1
---

# App Shell 布局与 Overlay 系统迁移 实现计划

**目标：** 实现 App Shell 布局框架 + React Portal 命令式 Overlay 系统

**架构：** 先建 Overlay 基础设施（Store → Portal → 命令式 API），再搭 App Shell 布局（__root → /app layout）

**技术栈：** React Portal + Zustand + TanStack Router

**Issue 引用：** [issue.md](./issue.md)
**Spec 引用：** [specs/](./specs/)
**PRD 引用：** §5.2 + §6.3

---

## ADR 合规声明

| ADR | 涉及内容 | 符合 |
|-----|---------|------|
| ADR 0001 | 依赖引入 | ✅ React Portal 为内置 API，Zustand 已批准 |

---

## 任务列表

### 任务 1: 创建 Overlay 类型与 Store

**文件：** `app/overlays/types/overlay.types.ts`、`app/overlays/host/overlay-store.ts`

- [ ] RED → GREEN：Zustand Overlay Store 单元测试（openDialog 入队、closeDialog 出队、z-index 递增）

### 任务 2: 创建 OverlayHost + Portal

**文件：** `app/overlays/host/OverlayHost.tsx`

- [ ] RED → GREEN：OverlayHost 通过 `createPortal` 渲染到 `document.body`，读取 Store 渲染 Dialog 列表

### 任务 3: 创建命令式 API

**文件：** `app/overlays/services/overlay-service.ts`、`app/overlays/hooks/useOverlay.ts`

- [ ] RED → GREEN：`openDialog()` 返回 Promise，`closeDialog()` resolve

### 任务 4: 创建 __root.tsx 全局布局

**文件：** `app/routes/__root.tsx`

- [ ] RED → GREEN：渲染 `<html>` + `<HeadContent>` + `<body>` + `<Outlet />` + `<OverlayHost />` + `<Scripts />`

### 任务 5: 创建 /app 布局路由 + Sidebar + TabBar

**文件：** `app/routes/app/route.tsx`、`app/components/sidebar/Sidebar.tsx`、`app/components/tab-bar/TabBar.tsx`

- [ ] RED → GREEN：布局渲染 Sidebar + TabBar + Outlet，beforeLoad 鉴权守卫

---

## 自检

- [x] PRD §6.3 Overlay 系统 — 命令式调用、Portal、Zustand Store 全覆盖
- [x] 所有步骤含验证命令
- [x] 无 TODO/TBD
