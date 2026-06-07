# 行为规格：App Shell 布局与 Overlay 系统迁移

> 状态：draft | 关联 issue：f-34

---

## 1. App Shell 交互

| 事件 | 行为 |
|------|------|
| 登录后进入 /app | 渲染 Sidebar + TabBar + 默认子路由内容 |
| 点击 Sidebar 项目 | TabBar 新增/激活页签，Outlet 渲染对应页面 |
| 点击 TabBar 页签 | 切换 Outlet 内容 |
| 关闭 TabBar 页签 | 若为最后页签 → Outlet 渲染空状态 |
| 侧边栏折叠 | Sidebar 切换为图标模式（宽度缩小） |

## 2. Overlay 系统行为

### 2.1 Dialog

| 事件 | 行为 |
|------|------|
| `openDialog(MyDialog, { title })` | 创建 Portal，z-index 递增，渲染到 OverlayHost |
| `closeDialog(id)` | 移除 Dialog，resolve 返回结果 |
| 点击 Dialog 遮罩 | 若 `closeOnOverlay: true`（默认），关闭 Dialog |
| 按 Escape | 关闭最顶层 Dialog |
| 同时打开多个 Dialog | 层级叠加，后打开的在上层 |
| `closeAllDialogs()` | 一键关闭所有弹窗 |

### 2.2 ContextMenu

| 事件 | 行为 |
|------|------|
| `openContextMenu(Menu, props, {x, y})` | 在指定位置渲染菜单 |
| 点击菜单外部 | 关闭菜单 |
| 点击菜单项 | 执行回调 → 关闭菜单 |

## 3. 测试映射

| AC | 测试文件 |
|----|----------|
| AC-01 ~ AC-03 | `tests/unit/web/app-shell.spec.tsx` |
| AC-04 ~ AC-08 | `tests/unit/web/overlay-system.spec.tsx` |
