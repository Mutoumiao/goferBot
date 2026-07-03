# Overlay 弹窗系统

> Web 端命令式 Portal 弹窗系统的架构和使用指南。

---

## 概述

项目使用自建 **4 层 Portal 弹窗系统**，而非 React 生态的第三方弹窗库。核心设计理念：**命令式 API + Promise 返回值 + Portal 渲染**，让弹窗调用像 `await openDialog(...)` 一样自然。

## 4 层架构

```
┌──────────────────────────────────────────┐
│  调用方 (useOverlay hook)                 │  ← Layer 4: 消费层
│  const result = await openDialog(...)     │
├──────────────────────────────────────────┤
│  overlay-service (命令式 Service)         │  ← Layer 3: 服务层
│  openDialog() → push() → Promise          │
├──────────────────────────────────────────┤
│  overlay-store (Zustand Store)            │  ← Layer 2: 状态层
│  entries[] / nextZIndex / push / remove   │
├──────────────────────────────────────────┤
│  OverlayHost (React Portal Renderer)       │  ← Layer 1: 渲染层
│  createPortal(entries → document.body)    │
└──────────────────────────────────────────┘
```

---

## 命令式 Promise API

### 基本用法

```typescript
import { openDialog } from '@/overlays/services/overlay-service'

// 打开弹窗，await 等待用户操作结果
const result = await openDialog(ConfirmDialog, {
  title: '确认删除？',
  message: '此操作不可撤销',
})

if (result === 'confirm') {
  // 用户点击了确认
}
```

### 实现原理

```typescript
// packages/web/src/overlays/services/overlay-service.ts
export function openDialog<T = unknown>(
  component: React.ComponentType<WithOnClose<T>>,
  props?: Record<string, unknown>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = overlayStore.getState().push({
      kind: 'dialog',
      component,
      props,
      resolve,    // Promise resolve 注入 Store
      reject,     // Promise reject 注入 Store
    })
  })
}
```

`resolve/reject` 被注入到 `OverlayEntry` 中，弹窗关闭时通过 `remove(id, result)` 触发 Promise 完成。

---

## OverlayEntry 数据模型

```typescript
// packages/web/src/overlays/types/overlay.types.ts
interface OverlayEntry<T = unknown> {
  id: string
  kind: 'dialog' | 'context-menu'
  component: React.ComponentType
  props?: Record<string, unknown>
  zIndex: number
  position?: { x: number; y: number }   // context-menu 专用
  resolve?: (value: T) => void           // Promise resolve
  reject?: (reason?: unknown) => void    // Promise reject
}
```

两种弹窗类型：
- `dialog` — 无位置，渲染在视口中央
- `context-menu` — 携带 `position: {x, y}` 屏幕坐标（右键菜单场景）

---

## Zustand Store

```typescript
// packages/web/src/overlays/host/overlay-store.ts
interface OverlayState {
  entries: OverlayEntry[]
  nextZIndex: number

  push: (entry) => string    // 分配全局唯一 id，nextZIndex += 1000
  remove: (id, result) => void  // 触发 resolve(result)，清理 entry
  closeAll: () => void          // resolve(undefined) 全部关闭
}
```

**zIndex 自增规则**：`nextZIndex` 初始 1000，每次 `push` 后 `+= 1000`。确保后打开的弹窗在最上层。

**closeAll**：路由切换时调用，遍历所有 entry 调用 `resolve(undefined)`，清空 entries 数组。

---

## Portal 渲染（OverlayHost）

```tsx
// packages/web/src/overlays/host/OverlayHost.tsx
export function OverlayHost() {
  const entries = useOverlayStore((s) => s.entries)
  const remove = useOverlayStore((s) => s.remove)

  return createPortal(
    <>
      {entries.map((entry) => {
        const Comp = entry.component
        return (
          <Comp
            key={entry.id}
            {...entry.props}
            style={{ zIndex: entry.zIndex }}
            onClose={(result) => remove(entry.id, result)}  // 桥接点
          />
        )
      })}
    </>,
    document.body  // 渲染到 body 层
  )
}
```

**关键设计**：
- `createPortal(..., document.body)` 突破父组件 `overflow: hidden` / `z-index` 限制
- `onClose` 是 Portal 与 Store 的**唯一桥接点**
- 挂载在 `routes/__root.tsx` body 中，与页面主体平级

---

## 生命周期序列

```
1. openDialog(Component, props)
     ↓
2. overlayStore.push(entry)
     → 生成 id、自增 zIndex、注入 resolve/reject
     → entries 数组 push
     ↓
3. OverlayHost 重渲染
     → createPortal(Component, document.body)
     → props.onClose = (result) => remove(id, result)
     ↓
4. 用户在弹窗中操作
     → 点击确认/取消/关闭
     ↓
5. Component 调用 props.onClose(result)
     ↓
6. overlayStore.remove(id, result)
     → 触发 resolve(result) → openDialog() 的 Promise 完成
     → 从 entries 中移除
     ↓
7. OverlayHost 重渲染（弹窗消失）
```

---

## 弹窗组件两种 onClose 签名

### Alert 风格（确认/取消）

```tsx
// ConfirmDialog, DeleteKbDialog 等
interface AlertDialogProps {
  onClose: (result: 'confirm' | 'cancel') => void
}

// 使用
const result = await openDialog<'confirm' | 'cancel'>(ConfirmDialog, { title: '确认删除？' })
if (result === 'confirm') { /* 执行删除 */ }
```

### Form 风格（成功/取消）

```tsx
// CreateKbDialog, EditKbDialog 等
interface FormDialogProps {
  onClose: (success: boolean) => void
}

// 使用
const success = await openDialog<boolean>(CreateKbDialog, { mode: 'create' })
if (success) { /* 刷新列表 */ }
```

---

## useOverlay Hook

薄封装，提供类型安全的 API：

```typescript
// packages/web/src/overlays/hooks/useOverlay.ts
export function useOverlay() {
  return {
    dialog: openDialog,
    closeDialog,
    contextMenu: openContextMenu,
    closeContextMenu,
    closeAll,
  }
}
```

---

## 11 个预置弹窗组件

| 组件 | 类型 | onClose 签名 | 说明 |
|------|------|-------------|------|
| `ConfirmDialog` | Alert | `'confirm' \| 'cancel'` | 通用确认 |
| `CreateKbDialog` | Form | `boolean` | 创建知识库 |
| `CreateFolderDialog` | Form | `boolean` | 创建文件夹 |
| `DeleteKbDialog` | Alert | `true \| false \| 'refresh'` | 删除知识库 |
| `DeleteItemDialog` | Alert | `'confirm' \| 'cancel'` | 删除文档/文件夹 |
| `DeleteSessionDialog` | Alert | `'confirm' \| 'cancel'` | 删除会话 |
| `EditKbDialog` | Form | `boolean` | 编辑知识库 |
| `EditNameDialog` | Form | `boolean` | 编辑名称 |
| `EditAvatarDialog` | Form | `boolean` | 编辑头像 |
| `RenameItemDialog` | Form | `boolean` | 重命名文档 |
| `PreviewDialog` | View | N/A | 文档预览 |

---

## 最佳实践

### ✅ 正确的用法

```typescript
// 在组件中使用
const { dialog } = useOverlay()

const handleDelete = async () => {
  const result = await dialog<'confirm' | 'cancel'>(ConfirmDialog, {
    title: '确认删除？',
  })
  if (result === 'confirm') {
    await deleteItem(id)
    toast.success('删除成功')
  }
}
```

### ❌ 禁止的做法

```tsx
// ❌ 不要在 Overlay 系统外使用 Portal
// ❌ 不要直接操作 overlayStore（应通过 overlayService）
// ❌ 不要在 onClose 中抛出异常（会导致 Promise rejection）
// ❌ 不要嵌套 openDialog（await 一个弹窗完成后再开另一个）
```

### closeAll 用于路由切换

```typescript
// packages/web/src/routes/__root.tsx
useEffect(() => {
  // 路由变化时关闭所有弹窗
  return () => overlayStore.getState().closeAll()
}, [location.pathname])
```

---

## 代码引用

| 规范 | 文件路径 |
|------|----------|
| 类型定义 | `packages/web/src/overlays/types/overlay.types.ts` |
| Zustand Store | `packages/web/src/overlays/host/overlay-store.ts` |
| 命令式 Service | `packages/web/src/overlays/services/overlay-service.ts` |
| Portal 渲染 | `packages/web/src/overlays/host/OverlayHost.tsx` |
| useOverlay Hook | `packages/web/src/overlays/hooks/useOverlay.ts` |
| 弹窗组件 | `packages/web/src/overlays/dialogs/*.tsx` |
| 根路由挂载 | `packages/web/src/routes/__root.tsx` |
