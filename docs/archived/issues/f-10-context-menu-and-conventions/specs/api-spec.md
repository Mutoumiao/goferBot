---
name: f-10-api-spec
description: ContextMenu 迁移与前端 overlay 规范文档的 API 规格
metadata:
  type: spec
  issue: f-10
  track: frontend
---

# API 规格：ContextMenu 迁移至 overlays/

## 函数式 API

### openContextMenu

```ts
import { openContextMenu } from '@/overlays'

openContextMenu(FileContextMenu, {
  x: 120,
  y: 200,
  item: folderOrDocument,
  onAction: (action, item) => { ... }
})
```

#### 参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| component | `Component` | 是 | ContextMenu 组件 |
| props | `ContextMenuBaseProps & Record<string, unknown>` | 是 | 组件 props，必须包含 `x`、`y` |

#### 返回值

- `string` — overlay id，可用于 `closeContextMenu(id)`

### closeContextMenu / closeAllContextMenus

```ts
import { closeContextMenu, closeAllContextMenus } from '@/overlays'

closeContextMenu(id)      // 关闭指定菜单
closeAllContextMenus()    // 关闭所有菜单
```

## ContextMenu 组件 Props 规范

### 基础 Props（来自 ContextMenuBaseProps）

```ts
interface ContextMenuBaseProps {
  x: number           // 菜单左上角 x 坐标（视口坐标）
  y: number           // 菜单左上角 y 坐标（视口坐标）
  onClose?: () => void  // 菜单关闭回调（可选）
}
```

### 业务 Props（由各组件自行扩展）

**FileContextMenu（FileManager 用）：**

```ts
interface FileContextMenuProps extends ContextMenuBaseProps {
  item: DocumentItem | Folder | null   // null 表示空白处右键
  onAction: (action: 'open' | 'rename' | 'delete' | 'createFolder', item?: DocumentItem | Folder) => void
}
```

**FileExplorerContextMenu（FileExplorer 用）：**

```ts
interface FileExplorerContextMenuProps extends ContextMenuBaseProps {
  fileName: string | null   // null 表示空白处右键
  onAction: (action: 'rename' | 'move' | 'copy' | 'delete' | 'createFolder', fileName?: string) => void
}
```

## 组件内部 API

### defineContextMenu

```ts
import { defineContextMenu } from '@/overlays'

const { isOpen, close } = defineContextMenu()
```

- `isOpen: Ref<boolean>` — 菜单是否打开（始终为 true，用于过渡动画）
- `close: () => void` — 关闭菜单，从 OverlayHost 移除

## 废弃 API

| API | 替代方案 | 说明 |
|-----|----------|------|
| `ContextMenu.vue`（Teleport 自实现） | `openContextMenu()` + 独立组件 | 旧组件废弃，引用处全部替换 |

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| 正常打开 | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-01: openContextMenu creates overlay in queue |
| Props 传递 | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-02: ContextMenu renders with correct props and position |
| 关闭 | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-03: close() removes overlay from queue |
| 视口边界 | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-04: menu adjusts position near viewport edge |
| 外部点击 | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-05: click outside closes context menu |
| ESC | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-06: Escape key closes context menu |
| 菜单项回调 | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-07: menu item click invokes callback and closes |
| FileManager 回归 | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-08: FileManager context menu works via openContextMenu |
| FileExplorer 回归 | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-09: FileExplorer context menu works via openContextMenu |
| 规范文档 | `tests/issues/f-10-context-menu-and-conventions/contextMenus.spec.ts` | AC-10: overlay-conventions.md covers directory, types, a11y |
