---
name: f-10-behavior-spec
description: ContextMenu 迁移与前端 overlay 规范文档的行为规格
metadata:
  type: spec
  issue: f-10
  track: frontend
---

# 行为规格：ContextMenu 迁移至 overlays/

## 入口

- **代码入口**：业务组件中调用 `openContextMenu(Component, props)` 打开菜单；菜单内部调用 `close()`（来自 `defineContextMenu()`）关闭
- **组件入口**：ContextMenu 组件通过 `defineContextMenu()` 获取 `{ isOpen, close }`，通过 props 接收坐标和业务数据
- **框架入口**：`OverlayHost` 已在 `App.vue` 中挂载，无需修改

## 初始状态

- 页面加载后，所有 ContextMenu 均未打开，DOM 中无菜单残留
- `openContextMenu` / `closeContextMenu` / `closeAllContextMenus` 可用
- 原组件内联 ContextMenu 的 `v-if` / `Teleport` 模式已移除

## 交互状态

| 状态 | 视觉 | 触发条件 | 系统响应 |
|------|------|----------|----------|
| 打开 | 菜单出现在鼠标右键位置，z-index 高于页面内容 | 用户右键点击，调用 `openContextMenu(Component, { x, y, ... })` | OverlayHost 将菜单组件加入渲染队列，z-index 自动分配 |
| 视口边界 | 菜单自动偏移，完整显示在视口内（不超出右/下边界） | 右键位置靠近视口边缘 | 组件内部计算 `left = min(x, viewportWidth - menuWidth)`，同理 top |
| 关闭 | 菜单消失，DOM 卸载 | 用户点击菜单外 / 按 ESC / 点击菜单项 | `close()` 调用 → OverlayHost 移除 → DOM 卸载 |
| 异常关闭 | 菜单关闭，控制台可能输出错误 | 组件内部未捕获异常 | `onErrorCaptured` 触发 overlay 移除（f-08 已实现） |

## 可访问性

| 行为 | 实现方式 | 可禁用？ |
|------|----------|----------|
| ESC 关闭 | 全局 keydown 监听 Escape | — |
| 点击外部关闭 | 全局 click 监听，判断目标不在菜单内 | — |
| 焦点管理 | 菜单打开后首项自动 focus（可选） | ✅ 通过 `autoFocusFirst` prop |

## 正常流程

### 通用 ContextMenu 打开与关闭流程

| 步骤 | 操作者 | 操作 | 系统响应 | 视觉状态 |
|------|--------|------|----------|----------|
| 1 | 用户 | 在文件/空白处右键点击 | 调用 `openContextMenu(MenuComponent, { x, y, item })` | 菜单出现在鼠标位置 |
| 2 | 用户 | 点击菜单项（如"重命名"） | 调用对应回调，组件内部调用 `close()` | 菜单消失，DOM 卸载，后续 Dialog 可能打开 |
| 3 | 用户 | 点击菜单外或按 ESC | `close()` 调用 → 无回调触发 | 菜单消失，DOM 卸载 |

### 各页面差异

| 页面 | 菜单项 | 触发对象 |
|------|--------|----------|
| FileManager（文件/文件夹） | 打开、重命名、删除 | 文件/文件夹卡片 |
| FileManager（空白处） | 新建文件夹 | 网格空白区域 |
| FileExplorer（文件） | 重命名、移动、复制、删除 | 文件列表行 |
| FileExplorer（空白处） | 新建文件夹 | 列表空白区域 |

## 错误场景

| 场景 | 触发 | 视觉 | 恢复 |
|------|------|------|------|
| 右键位置超出视口 | 窗口很小或鼠标在边缘 | 菜单自动偏移至可视区域 | 无需恢复 |
| 组件未传入坐标 | `openContextMenu(Menu, {})` | 菜单出现在 `(0, 0)` | 规范要求调用方必传 `x/y` |
| 快速重复右键 | 连续两次右键 | 先关闭旧菜单，再打开新菜单（`closeAllContextMenus` 后打开） | 无需恢复 |

## 测试映射

| 交互状态 | 测试文件 | 测试用例 |
|----------|----------|----------|
| 打开 | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-01: openContextMenu creates overlay in queue |
| 渲染 | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-02: ContextMenu renders with correct props and position |
| 关闭 | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-03: close() removes overlay from queue |
| 边界 | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-04: menu adjusts position near viewport edge |
| 外部点击 | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-05: click outside closes context menu |
| ESC | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-06: Escape key closes context menu |
| 菜单项回调 | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-07: menu item click invokes callback and closes |
| 回归 | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-08: FileManager context menu works via openContextMenu |
| 回归 | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-09: FileExplorer context menu works via openContextMenu |
| 规范 | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-10: overlay-conventions.md covers directory, types, a11y |
