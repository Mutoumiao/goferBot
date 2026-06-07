# 前端 Overlay 规范

> 统一规范 Vue 和 React 项目的弹窗管理，保持一致的命令式调用设计。

---

## 设计原则

1. **命令式调用** —— `openDialog(Component, props)` 而非声明式嵌套
2. **统一管理** —— 所有弹窗走 OverlayHost，便于全局控制
3. **类型安全** —— 基础 Props + 业务 Props 扩展
4. **强制规范** —— 禁止内联声明，确保一致性

---

## 目录结构

### Vue 项目（packages/webui）

```
packages/webui/src/overlays/
  dialogs/              # Dialog 组件
  context-menus/        # ContextMenu 组件
  host/                 # OverlayHost 渲染宿主（Teleport）
  services/             # openDialog / openContextMenu 服务
  composables/          # defineDialog / defineContextMenu
  types/                # 类型定义
```

### React 项目（packages/web）

```
packages/web/app/overlays/
  dialogs/              # Dialog 组件
  context-menus/        # ContextMenu 组件
  host/                 # OverlayHost 渲染宿主（Portal）+ Zustand Store
  services/             # openDialog / openContextMenu 服务
  hooks/                # useDialog / useContextMenu
  types/                # 类型定义
```

**禁止：**
- 在业务组件模板/JSX 中内联声明 Dialog / ContextMenu
- 在 `components/` 下新建 Dialog / ContextMenu
- 自实现浮层（统一走 OverlayHost）

---

## 类型安全

### Dialog Props

```ts
interface DialogBaseProps {
  onClose?: () => void
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void
  disableEsc?: boolean
  disableOverlayClick?: boolean
}
```

### ContextMenu Props

```ts
interface ContextMenuBaseProps {
  x: number
  y: number
  onClose?: () => void
}
```

**规则：**
- 所有回调使用可选链（`props.onConfirm?.()`）
- 业务 Props 通过 `extends DialogBaseProps | ContextMenuBaseProps` 扩展
- 禁止 `any` 类型

---

## 可访问性

| 行为 | Dialog | ContextMenu |
|------|--------|-------------|
| ESC 关闭 | 默认启用，`disableEsc` 可禁用 | 始终启用 |
| 遮罩点击关闭 | 默认启用，`disableOverlayClick` 可禁用 | 始终启用（点击菜单外） |
| 焦点管理 | 自动 focus trap | 首项自动 focus（可选） |
| 背景滚动锁定 | 自动处理 | 无需锁定 |

---

## 调用规范

### 打开 Dialog

**Vue**
```ts
import { openDialog } from '@/overlays'
import MyDialog from '@/overlays/dialogs/MyDialog.vue'

openDialog(MyDialog, {
  title: '标题',
  onConfirm: async () => { await save() },
})
```

**React**
```tsx
import { openDialog } from '@/overlays'
import MyDialog from '@/overlays/dialogs/MyDialog'

openDialog(MyDialog, {
  title: '标题',
  onConfirm: async () => { await save() },
})
```

### 打开 ContextMenu

**Vue**
```ts
import { openContextMenu, closeAllContextMenus } from '@/overlays'
import MyMenu from '@/overlays/context-menus/MyMenu.vue'

function onRightClick(e: MouseEvent) {
  closeAllContextMenus()
  openContextMenu(MyMenu, {
    x: e.clientX,
    y: e.clientY,
    onAction: (action) => { ... },
  })
}
```

**React**
```tsx
import { openContextMenu, closeAllContextMenus } from '@/overlays'
import MyMenu from '@/overlays/context-menus/MyMenu'

function onRightClick(e: React.MouseEvent) {
  closeAllContextMenus()
  openContextMenu(MyMenu, {
    x: e.clientX,
    y: e.clientY,
    onAction: (action) => { ... },
  })
}
```

---

## 组件内部规范

### Vue

```ts
const { isOpen, close } = defineDialog()   // Dialog 用
const { isOpen, close } = defineContextMenu()  // ContextMenu 用
```

### React

```tsx
const { isOpen, close } = useDialog()   // Dialog 用
const { isOpen, close } = useContextMenu()  // ContextMenu 用
```

**通用规则：**
- 确认按钮调用 `onConfirm` → `await` → `close()`
- 取消/关闭直接调用 `close()`
- 菜单项点击调用回调 → `close()`

---

## 视口边界检测

ContextMenu 组件内部负责，使用 `offsetWidth/offsetHeight` 获取实际尺寸：

**Vue**
```ts
const menuRef = ref<HTMLElement | null>(null)

const position = computed(() => {
  const menuWidth = menuRef.value?.offsetWidth ?? 160
  const menuHeight = menuRef.value?.offsetHeight ?? 200
  const left = Math.max(0, Math.min(props.x, window.innerWidth - menuWidth))
  const top = Math.max(0, Math.min(props.y, window.innerHeight - menuHeight))
  return { left: `${left}px`, top: `${top}px` }
})
```

**React**
```tsx
const menuRef = useRef<HTMLDivElement>(null)

const position = useMemo(() => {
  const menuWidth = menuRef.current?.offsetWidth ?? 160
  const menuHeight = menuRef.current?.offsetHeight ?? 200
  const left = Math.max(0, Math.min(props.x, window.innerWidth - menuWidth))
  const top = Math.max(0, Math.min(props.y, window.innerHeight - menuHeight))
  return { left: `${left}px`, top: `${top}px` }
}, [props.x, props.y])
```

---

## 新增组件 checklist

- [ ] 放在 `overlays/dialogs/` 或 `overlays/context-menus/`
- [ ] Vue 使用 `defineDialog()` / `defineContextMenu()`，React 使用 `useDialog()` / `useContextMenu()`
- [ ] Props 扩展 `DialogBaseProps` / `ContextMenuBaseProps`
- [ ] 回调使用可选链
- [ ] 编写测试（Vue: `.spec.ts`，React: `.test.tsx`）
- [ ] 在 `overlays/index.ts` 导出
