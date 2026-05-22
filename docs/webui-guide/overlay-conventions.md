# 前端 Overlay 规范

## 目录约束

所有 Dialog 和 ContextMenu 必须放在 `packages/webui/src/overlays/` 下：

```
overlays/
  dialogs/          # Dialog 组件
  context-menus/    # ContextMenu 组件
  host/             # OverlayHost 渲染宿主（勿动）
  services/         # openDialog / openContextMenu 服务（勿动）
  composables/      # defineDialog / defineContextMenu（勿动）
  types/            # 类型定义（勿动）
```

**禁止：**
- 在业务组件模板中内联声明 Dialog / ContextMenu
- 在 `components/` 下新建 Dialog / ContextMenu
- 使用 Teleport 自实现浮层（统一走 OverlayHost）

## 类型安全

### Dialog Props

```ts
interface DialogBaseProps {
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

## 可访问性

| 行为 | Dialog | ContextMenu |
|------|--------|-------------|
| ESC 关闭 | 默认启用，`disableEsc` 可禁用 | 始终启用 |
| 遮罩点击关闭 | 默认启用，`disableOverlayClick` 可禁用 | 始终启用（点击菜单外） |
| 焦点管理 | reka-ui 自动 focus trap | 首项自动 focus（可选，当前未实现） |
| 背景滚动锁定 | reka-ui 自动处理 | 无需锁定 |

## 调用规范

### 打开 Dialog

```ts
import { openDialog } from '@/overlays'
import MyDialog from '@/overlays/dialogs/MyDialog.vue'

openDialog(MyDialog, {
  title: '标题',
  onConfirm: async () => { await save() },
})
```

### 打开 ContextMenu

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

## 组件内部规范

```ts
const { isOpen, close } = defineDialog()   // Dialog 用
const { isOpen, close } = defineContextMenu()  // ContextMenu 用
```

- 确认按钮调用 `onConfirm` → `await` → `close()`
- 取消/关闭直接调用 `close()`
- 菜单项点击调用回调 → `close()`

## 视口边界检测

ContextMenu 组件内部负责，使用 `offsetWidth/offsetHeight` 获取实际尺寸：

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

## 新增组件 checklist

- [ ] 放在 `overlays/dialogs/` 或 `overlays/context-menus/`
- [ ] 使用 `defineDialog()` / `defineContextMenu()`
- [ ] Props 扩展 `DialogBaseProps` / `ContextMenuBaseProps`
- [ ] 回调使用可选链
- [ ] 编写 `.spec.ts` 测试（AC-XX 命名）
- [ ] 在 `overlays/index.ts` 导出
