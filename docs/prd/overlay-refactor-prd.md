# 前端 Dialog / ContextMenu 函数式调用重构 PRD

## 背景与问题

当前前端代码中，Dialog 和 ContextMenu 的复用度极低，存在以下问题：

- `FileManager.vue` 等组件直接在模板中内联声明 Dialog，通过 `ref` 控制显隐
- ContextMenu 存在自定义 `ContextMenu.vue` 组件，但 `FileManager.vue` 中又内联实现了一套，未复用
- 组件颗粒度差，无法在其他页面复用
- 代码质量堪忧，缺乏统一的调用规范和目录管理

## 目标

1. 将所有 Dialog 和 ContextMenu 抽离为独立组件，统一放入 `overlays/` 层管理
2. 提供函数式调用 API（`openDialog()` / `openContextMenu()`），通过 props（含回调）传递状态和结果
3. 关闭后组件完全卸载，不常驻 DOM
4. 建立前端专项规范，确保未来所有新增 Dialog/ContextMenu 都走这套机制

## 非目标

- 不替换 shadcn-vue 的底层 Dialog/ContextMenu 原子组件（继续复用其样式和结构）
- 不引入 Promise 风格 API（保持回调风格）
- 不改动与 Dialog/ContextMenu 无关的业务逻辑

## 方案概述

采用 **Overlay Host + 动态渲染队列** 机制：

- `OverlayHost.vue` 常驻于 body 末尾，维护一个 `overlays[]` 队列
- `dialogService.open(Component, props)` 向队列 push overlay 配置，Host 用 `<component :is="...">` 动态渲染
- 组件内部调用 `close()` 后从队列移除，Vue 自动卸载组件树
- 对外暴露函数式 API，对内组件就是普通 SFC

## 目录结构

```
packages/webui/src/
  overlays/
    host/
      OverlayHost.vue           # 统一渲染宿主，挂载到 body
      useOverlayHost.ts         # Host 注册/卸载/队列管理
    dialogs/                    # 所有 Dialog 组件
      ConfirmDialog.vue
      PromptDialog.vue
      MoveCopyDialog.vue        # 从现有组件迁移
      EditKbDialog.vue          # 从现有组件迁移
      ...                       # 从 FileManager 等抽离
    context-menus/              # 所有 ContextMenu 组件
      FileContextMenu.vue
      ...                       # 从 FileManager 等抽离
    services/
      dialog.service.ts         # openDialog() / closeDialog()
      context-menu.service.ts   # openContextMenu() / closeContextMenu()
    composables/
      useDialog.ts              # defineDialog() 辅助函数
      useContextMenu.ts         # defineContextMenu() 辅助函数
    types/
      overlay.types.ts          # OverlayItem、DialogProps、ContextMenuProps 等
    index.ts                    # 统一导出
```

## API 设计

### Dialog 调用方

```ts
import { confirmDialog } from '@/overlays/dialogs/ConfirmDialog'

confirmDialog({
  title: '确认删除',
  message: '确定删除此文件吗？',
  confirmText: '删除',
  cancelText: '取消',
  onConfirm: () => {
    // 执行删除
  },
  onCancel: () => {
    // 取消
  }
})
```

### ContextMenu 调用方

```ts
import { fileContextMenu } from '@/overlays/context-menus/FileContextMenu'

fileContextMenu({
  x: event.clientX,
  y: event.clientY,
  fileId: file.id,
  onRename: () => { /* ... */ },
  onDelete: () => { /* ... */ }
})
```

### Dialog 组件内部

```vue
<script setup lang="ts">
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { defineDialog } from '@/overlays/composables/useDialog'

interface Props {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void
}

const props = defineProps<Props>()

const { open, close } = defineDialog()

async function handleConfirm() {
  await props.onConfirm?.()
  close() // 异步完成后自动触发卸载
}

function handleCancel() {
  props.onCancel?.()
  close()
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => !v && close()">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>
      <p>{{ message }}</p>
      <div class="flex justify-end gap-2">
        <Button variant="secondary" @click="handleCancel">{{ cancelText || '取消' }}</Button>
        <Button variant="default" @click="handleConfirm">{{ confirmText || '确认' }}</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
```

## 核心机制

### OverlayHost

- 在 `main.ts` 中通过 `app.component('OverlayHost', OverlayHost)` 注册
- 在 `App.vue` 模板中声明 `<OverlayHost />`（或通过 Teleport 挂载到 body）
- 内部维护响应式队列 `overlays: OverlayItem[]`
- 每个 overlay 包含 `id`、`component`、`props`
- **z-index 管理**：Host 根节点固定 `z-index: 9999`，内部 overlay 按队列顺序自动分配递增层级，确保后打开的 Dialog 始终在最上层
- **兜底清理**：页面 `beforeunload` 事件中清空队列，防止刷新后 DOM 残留；组件异常时由 Vue 错误处理器触发对应 overlay 的移除

### dialogService

```ts
function openDialog<TProps extends DialogBaseProps>(
  component: Component,
  props: TProps
): string // 返回 overlay id，使用 crypto.randomUUID() 生成

function closeDialog(id: string): void
function closeAllDialogs(): void // 强制关闭所有 Dialog，用于路由跳转等场景
```

**约束**：
- `props` 必须经过类型约束，禁止直接传递 `Record<string, any>`
- 回调函数统一为可选，内部使用可选链调用
- 如果 `onConfirm` 返回 `Promise`，`close()` 应在 Promise resolve 后执行

### defineDialog

封装以下样板代码：
- 创建 `open` 响应式状态（默认 true）
- 提供 `close()` 方法：向 Host 发送移除指令
- 提供 `onUnmounted` 钩子：若组件因异常未正常关闭，确保通知 Host 清理队列
- **交互规范**：自动绑定 ESC 键关闭、点击遮罩关闭（可通过 props 禁用）

### contextMenuService

```ts
function openContextMenu<TProps extends ContextMenuBaseProps>(
  component: Component,
  props: TProps
): string

function closeContextMenu(id: string): void
function closeAllContextMenus(): void
```

**边界检测**：
- ContextMenu 打开前必须计算视口边界，若 `x + menuWidth > viewportWidth` 则向左展开
- 若 `y + menuHeight > viewportHeight` 则向上展开
- 菜单项点击后自动关闭

## 交互与可访问性规范

1. **焦点管理**：Dialog 打开时，焦点应自动聚焦到第一个可交互元素（通常是确认按钮）；关闭时焦点应回到触发元素
2. **ESC 关闭**：所有 Dialog 默认支持 ESC 键关闭（可通过 `disableEsc` props 禁用）
3. **遮罩点击**：所有 Dialog 默认支持点击遮罩关闭（可通过 `disableOverlayClick` props 禁用）
4. **滚动锁定**：Dialog 打开时，背景页面应禁止滚动（`overflow: hidden` 或类似机制）
5. **ContextMenu**：点击菜单外部或按下 ESC 应自动关闭

## 迁移范围

### 需要迁移的现有内联实现

1. `FileManager.vue` 内联的 Dialog（新建/重命名/删除）
2. `FileManager.vue` 内联的 ContextMenu
3. 其他文件中直接声明在模板内的 Dialog（扫描后补充完整列表）
4. 现有的 `ConfirmDialog.vue`（自定义 Teleport 实现，需评估是否替换为 shadcn 基础组件）
5. 现有的 `EditKbDialog.vue`、`MoveCopyDialog.vue`（评估是否迁移到 `overlays/dialogs/`）

### 不需要迁移的

- `packages/webui/src/components/ui/dialog/` 等 shadcn-vue 原子组件（继续作为底层依赖）
- 非函数式调用、但已独立封装的业务组件（如已满足独立组件化要求的）

## 类型定义

```ts
// overlay.types.ts
import type { Component } from 'vue'

export interface OverlayItem<TProps = unknown> {
  id: string
  component: Component
  props: TProps
}

export interface DialogBaseProps {
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void
  disableEsc?: boolean
  disableOverlayClick?: boolean
}

export interface ContextMenuBaseProps {
  x: number
  y: number
  onClose?: () => void
}
```

**类型安全约束**：
- 禁止在任何 overlay 相关的接口中使用 `Record<string, any>`
- 每个 Dialog/ContextMenu 组件必须定义独立的 `Props` interface 并继承对应的 `BaseProps`
- `openDialog` 和 `openContextMenu` 使用泛型约束确保 props 类型正确传递

## 规范化约束

写入 `docs/webui-guide/overlay-conventions.md`：

### 目录与调用规范

1. **禁止在业务组件模板中直接写 `<Dialog>` 或 `<ContextMenu>`**（shadcn 原子组件除外）
2. **所有 Dialog 必须放在 `overlays/dialogs/`，所有 ContextMenu 必须放在 `overlays/context-menus/`**
3. **组件只允许接收 props（含回调函数），禁止 `$emit`**
4. **回调函数命名规范**：确认类用 `onConfirm`，取消类用 `onCancel`，选择类用 `onSelect`，关闭类用 `onClose`
5. **组件卸载由 `defineDialog()` / `defineContextMenu()` 统一管理**，业务组件不直接操作 DOM
6. **新增 Dialog/ContextMenu 时必须先评估是否已有可复用组件**，避免重复造轮子

### 类型安全规范

7. **禁止在任何 overlay 接口中使用 `any` 或 `Record<string, any>`**
8. 每个 Dialog/ContextMenu 必须定义独立的 `Props` interface 并继承对应的 `BaseProps`
9. 回调函数统一声明为可选（`?`），内部调用必须使用可选链（`?.()`）

### 可访问性与交互规范

10. Dialog 打开时焦点应自动聚焦到主操作按钮，关闭时焦点回到触发元素
11. 所有 Dialog 默认支持 ESC 关闭和遮罩点击关闭（可通过 props 显式禁用）
12. Dialog 打开期间背景页面禁止滚动
13. ContextMenu 必须做视口边界检测，避免超出屏幕

## 前端规范目录

新建 `docs/webui-guide/`，专门存放 `packages/webui/` 的专项规范：

```
docs/webui-guide/
  README.md                   # 入口说明
  overlay-conventions.md      # 本 PRD 对应的规范
```

同步更新：
- `CLAUDE.md` 项目结构区块
- `docs/guide/README.md` 文档体系架构图

## 测试策略

1. 为 `dialog.service.ts` 和 `context-menu.service.ts` 编写单元测试：验证 open/close 生命周期
2. 为 `defineDialog()` / `defineContextMenu()` 编写单元测试：验证 open 状态管理和卸载逻辑
3. 迁移后的每个 Dialog 组件保留原有业务逻辑的测试覆盖
4. 在 `FileManager.vue` 迁移后，验证其功能测试仍通过

## 风险与回退

| 风险 | 缓解措施 |
|------|----------|
| OverlayHost 与现有 Teleport 实现冲突 | 逐步替换，先迁移非关键 Dialog，验证无问题后再覆盖核心流程 |
| 动态渲染丢失全局 provide/inject | OverlayHost 作为 App 子组件，共享完整上下文 |
| 回调风格在复杂场景下嵌套过深 | 记录为已知限制，若未来出现可评估是否补充 Promise 风格 API |

## 验收标准

### 核心机制

- `packages/webui/src/overlays/` 目录建立完成，核心机制运行正常
- `OverlayHost` 能正确渲染多个堆叠 Dialog，z-index 层级递增
- 页面刷新或路由跳转时，所有 overlay 自动清理，DOM 无残留
- 组件异常崩溃时，Vue 错误处理器能触发对应 overlay 的移除

### 功能迁移

- `FileManager.vue` 内联 Dialog（新建/重命名/删除）全部迁移到 `overlays/dialogs/`
- `FileManager.vue` 内联 ContextMenu 迁移到 `overlays/context-menus/`
- 其他文件中直接声明在模板内的 Dialog 全部迁移完成
- 所有 Dialog/ContextMenu 可通过函数式 API 调用，关闭后 DOM 中无残留

### 类型与规范

- `overlay.types.ts` 中无 `any` 或 `Record<string, any>` 类型
- 所有回调函数均为可选，内部调用使用可选链
- `docs/webui-guide/overlay-conventions.md` 编写完成
- `CLAUDE.md` 和 `docs/guide/README.md` 已更新

### 可访问性与交互

- Dialog 打开时焦点自动聚焦到主操作按钮
- Dialog 支持 ESC 关闭和遮罩点击关闭（可被禁用）
- Dialog 打开期间背景页面禁止滚动
- ContextMenu 在视口边缘自动调整展开方向，不超出屏幕

### 测试

- `dialog.service.ts` 单元测试覆盖 open/close/closeAll 生命周期
- `context-menu.service.ts` 单元测试覆盖边界检测
- `defineDialog()` 单元测试覆盖 open 状态管理和卸载逻辑
- `FileManager.vue` 迁移后，原有功能测试仍通过
