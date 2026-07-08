# GoferBot Discovery Report

## 7. 复杂模块

### 7.19 Overlay 弹窗系统 — 命令式 Portal 架构

**数据来源**：[overlay.types.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/overlays/types/overlay.types.ts)、[overlay-store.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/overlays/host/overlay-store.ts)、[overlay-service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/overlays/services/overlay-service.ts)、[OverlayHost.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/overlays/host/OverlayHost.tsx)、[useOverlay.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/overlays/hooks/useOverlay.ts)

Overlay 弹窗系统是实现命令式弹窗调用的**4 层架构**，支持 dialog 和 context-menu 两种类型，通过 React Portal 渲染到 body 层。

#### 架构分层

```
┌─────────────────────────────────────────────────┐
│  React 组件层 (11 个预置 Dialog)                    │
│  DeleteSessionDialog / CreateKbDialog / ...       │
├─────────────────────────────────────────────────┤
│  命令式 API 层                                     │
│  openDialog<T>() → Promise<T>                     │
│  openContextMenu<T>() → Promise<T>                │
│  closeDialog / closeContextMenu / closeAll        │
├─────────────────────────────────────────────────┤
│  Zustand Store (状态管理)                          │
│  entries[] / nextZIndex / push / remove / closeAll│
├─────────────────────────────────────────────────┤
│  React Portal 渲染层                               │
│  OverlayHost → createPortal(..., document.body)   │
├─────────────────────────────────────────────────┤
│  类型定义                                          │
│  OverlayEntry / OverlayState / OverlayKind        │
└─────────────────────────────────────────────────┘
```

#### 完整生命周期

```
调用方                    Store               OverlayHost            Dialog 组件
  │                        │                      │                      │
  │──openDialog(Comp,props)────→ push(entry)       │                      │
  │    返回 Promise ◄────────── resolve/reject 注入 │                      │
  │                        │                      │                      │
  │                        │   entries[] 更新 ◄────│ 订阅 store           │
  │                        │                      │──createPortal──►     │
  │                        │                      │  <Comp {...props}   │
  │                        │                      │   onClose={fn} />   │
  │                        │                      │                      │
  │                        │                      │        用户交互 ────→│
  │                        │          onClose(result) ◄──────────────────│
  │                        │                      │                      │
  │                        │──remove(id, result)──→│                      │
  │                        │  resolve(result)      │                      │
  │   Promise resolve ◄────│                      │                      │
```

**核心机制**：
1. `openDialog` 创建 Promise，将 `resolve/reject` 注入 `OverlayEntry`
2. Store.push 生成唯一 id，zIndex 自增（起始 1000）
3. OverlayHost 订阅 entries 变化，通过 `createPortal` 渲染到 `document.body`
4. OverlayHost 为每个组件注入 `onClose(result)` prop
5. Dialog 组件调用 `onClose(result)` → `store.remove(id, result)` → Promise resolve
6. `closeAll()` 批量 resolve(undefined) 所有 pending Promise，清空 entries

#### OverlayEntry 数据模型

```ts
interface OverlayEntry {
  id: string                    // 全局唯一 ID
  kind: 'dialog' | 'context-menu'
  component: ComponentType      // React 组件
  props: Record<string, unknown>
  zIndex: number                // 自增层级
  position?: { x: number; y: number }  // context-menu 屏幕坐标
  resolve?: (value: unknown) => void   // Promise resolver
  reject?: (reason: unknown) => void   // Promise rejecter
}
```

#### 弹窗组件约定

所有弹窗组件接受统一的 `onClose` prop：

```ts
interface DialogProps {
  onClose?: (result?: unknown) => void
  // ... 其他业务 props
}
```

**两种返回值变体**：
- **Alert 风格**（DeleteSessionDialog/ConfirmDialog/DeleteKbDialog/DeleteItemDialog）：`onClose('confirm')` / `onClose('cancel')` — 调用方 `openDialog<'confirm' | undefined>(Comp, props)`
- **Form 风格**（CreateKbDialog/EditKbDialog/RenameItemDialog/EditNameDialog）：`onClose(true)` / `onClose(false)` — 调用方 `openDialog<boolean>(Comp, props)`

#### 两种弹窗类型

| 特性 | dialog | context-menu |
|------|--------|-------------|
| 渲染方式 | 居中 Dialog/AlertDialog | 绝对定位 div |
| 坐标 | 无 | `position: {x, y}` 屏幕像素 |
| 使用场景 | 创建/编辑/删除确认 | 右键菜单 |
| API | `openDialog(Comp, props)` | `openContextMenu(Comp, position, props)` |

#### Hook 封装

`useOverlay()` ([useOverlay.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/overlays/hooks/useOverlay.ts)) 是对服务的薄封装：

```ts
const overlay = useOverlay()
overlay.dialog(ConfirmDialog, { title: '确认？' })     // → Promise<'confirm' | 'cancel'>
overlay.contextMenu(FileMenu, { x: 100, y: 200 })       // → Promise<TResult>
overlay.closeAll()                                       // → 关闭全部
```

#### 挂载位置

OverlayHost 挂载在 `routes/__root.tsx` ([__root.tsx](file:///d:/projects/ai-stared-project/knowledge-base/packages/web/src/routes/__root.tsx#L78)) body 中，与 App 主体平级：

```tsx
<body>
  <App />         {/* 主应用 */}
  <OverlayHost /> {/* Portal 弹窗层 — createPortal 到 document.body */}
</body>
```

这确保 Portal 始终在 DOM 最顶层，不受父组件 `overflow: hidden` 或 `z-index` 堆叠上下文限制。

#### 11 个预置弹窗

| 弹窗 | 类型 | 说明 |
|------|------|------|
| ConfirmDialog | Alert | 通用确认弹窗（可配置 title/description/onConfirm） |
| CreateKbDialog | Form | 创建/编辑知识库（react-hook-form + Zod 校验） |
| CreateFolderDialog | Form | 创建文件夹 |
| DeleteKbDialog | Alert | 删除知识库确认（404→refresh/403→权限不足） |
| DeleteItemDialog | Alert | 删除（文件/文件夹）确认 |
| DeleteSessionDialog | Alert | 删除会话确认 |
| EditKbDialog | Form | 编辑知识库名称/描述 |
| EditNameDialog | Form | 编辑名称（通用） |
| EditAvatarDialog | Form | 编辑头像 |
| RenameItemDialog | Form | 重命名（文件/文件夹） |
| PreviewDialog | Form | 文件预览 |

***
