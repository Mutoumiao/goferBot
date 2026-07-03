# Overlay Portal 弹窗系统开发指南

> **NOTE**: 此文件记录开发指南（HOW）。Overlay Portal 是前端实现模式，无对应 OpenSpec capability。弹窗的业务行为由各业务模块的 OpenSpec 定义（如 Chat 的分享弹窗、知识库的创建弹窗）。

---

## Purpose

帮助开发者在 Overlay Portal 弹窗系统中高效工作：理解 4 层架构实现、正确使用命令式 Promise API、规避常见陷阱、扩展预置弹窗。

## Primary OpenSpec

- 无对应 capability。Overlay Portal 是前端实现模式。

## Related OpenSpec

- 各业务模块 OpenSpec（弹窗的业务行为由对应模块定义）

## Module Dependencies

- React `createPortal` — Portal 渲染底层
- Zustand — Overlay Store 状态管理
- shadcn/ui Dialog — 弹窗底层组件

## Development Entry

- `packages/web/src/overlays/` — Portal 系统全部文件
- `packages/web/src/overlays/types/overlay.types.ts` — 类型定义（OverlayEntry 等）
- `packages/web/src/overlays/host/overlay-store.ts` — Zustand Store
- `packages/web/src/overlays/services/overlay-service.ts` — 命令式 Service
- `packages/web/src/overlays/host/OverlayHost.tsx` — Portal 渲染器
- `packages/web/src/overlays/hooks/useOverlay.ts` — 类型安全 Hook
- `packages/web/src/overlays/dialogs/*.tsx` — 预置弹窗组件
- `packages/web/src/routes/__root.tsx` — OverlayHost 挂载点

## Implementation Notes

### 4 层架构实现模式

```
Layer 4 消费层  useOverlay hook → const result = await openDialog(...)
Layer 3 服务层  overlay-service → openDialog() push() Promise
Layer 2 状态层  overlay-store (Zustand) → entries[] / nextZIndex
Layer 1 渲染层  OverlayHost → createPortal(entries, document.body)
```

数据流：调用方 → service.push → store.entries → OverlayHost 重渲染 → 弹窗 onClose → store.remove → Promise resolve。

### 命令式 Promise API

```typescript
import { openDialog } from '@/overlays/services/overlay-service'

const result = await openDialog(ConfirmDialog, {
  title: '确认删除？',
  message: '此操作不可撤销',
})
if (result === 'confirm') { /* 用户确认 */ }
```

实现要点：`openDialog` 内部 `new Promise`，将 `resolve/reject` 注入 `OverlayEntry`；弹窗调用 `onClose(result)` 时由 `store.remove(id, result)` 触发 `resolve(result)`。

### createPortal 到 document.body

`OverlayHost` 使用 `createPortal(..., document.body)` 突破父组件 `overflow: hidden` / `z-index` 限制。`onClose` 是 Portal 与 Store 的**唯一桥接点**。OverlayHost 挂载在 `__root.tsx`，与页面主体平级。

### z-index 层级管理策略

`nextZIndex` 初始 1000，每次 `push` 后 `+= 1000`，确保后打开的弹窗在最上层。间隔 1000 为嵌套弹窗内部元素（如 Select、Tooltip）预留层级空间。

### 嵌套弹窗栈管理

`entries[]` 数组天然支持栈结构：新弹窗 push 到数组末尾，关闭时按 id 移除。ESC 键由最上层弹窗拦截（shadcn Dialog 默认行为）。

### 弹窗关闭与 Promise 时序

```
Component 调用 props.onClose(result)
  → store.remove(id, result)
  → 触发 resolve(result) → openDialog() 的 Promise 完成
  → entries 移除 → OverlayHost 重渲染 → 弹窗消失
```

### 两种 onClose 签名模式

- **Alert 风格**：`onClose: (result: 'confirm' | 'cancel') => void` — 用于确认/取消场景
- **Form 风格**：`onClose: (success: boolean) => void` — 用于表单提交场景

### 11 个预置弹窗分类

| 组件 | 类型 | onClose 签名 |
|------|------|-------------|
| `ConfirmDialog` | Alert | `'confirm' \| 'cancel'` |
| `CreateKbDialog` | Form | `boolean` |
| `CreateFolderDialog` | Form | `boolean` |
| `DeleteKbDialog` | Alert | `true \| false \| 'refresh'` |
| `DeleteItemDialog` | Alert | `'confirm' \| 'cancel'` |
| `DeleteSessionDialog` | Alert | `'confirm' \| 'cancel'` |
| `EditKbDialog` | Form | `boolean` |
| `EditNameDialog` | Form | `boolean` |
| `EditAvatarDialog` | Form | `boolean` |
| `RenameItemDialog` | Form | `boolean` |
| `PreviewDialog` | View | N/A |

## Testing Checklist

- [ ] `openDialog(Comp, props)` 正确渲染弹窗到 body
- [ ] Promise 在弹窗关闭后正确 `resolve(result)` / `reject`
- [ ] 嵌套弹窗正确栈管理（后开者在最上层）
- [ ] ESC 键只关闭最上层弹窗，不连锁关闭下层
- [ ] z-index 层级正确（新弹窗 > 旧弹窗）
- [ ] 路由切换时 `closeAll()` 正确触发所有 `resolve(undefined)`
- [ ] Alert 与 Form 两种 onClose 签名均能正确返回结果

## Review Checklist

- [ ] 新增弹窗是否注册到预置列表（上表）并放在 `dialogs/` 目录
- [ ] 弹窗 Props 类型是否完整，泛型 `<T>` 是否与 onClose 签名一致
- [ ] 弹窗关闭是否正确调用 `props.onClose` 并清理内部状态
- [ ] 是否避免直接操作 `overlayStore`（应通过 `overlayService` / `useOverlay`）
- [ ] 是否避免在 `onClose` 中抛异常（会导致 Promise rejection）

## Common Pitfalls

- **直接操作 `overlayStore`**：应通过 `overlayService` / `useOverlay` Hook，避免跳过 Promise 桥接
- **在 `onClose` 回调中抛异常**：会被 Promise 吞掉，应在弹窗内部 try/catch 后再调用 onClose
- **嵌套 `openDialog` 调用**：`await` 一个弹窗完成后再开另一个，容易造成栈堆积；应链式 `then` 或合并交互
- **在 Overlay 系统外使用 Portal**：会绕过 z-index 管理和 closeAll 清理，应复用 OverlayHost
- **忘记路由切换清理**：未在 `__root.tsx` 注册 `closeAll`，会导致切换页面后弹窗残留
- **z-index 硬编码**：弹窗内部元素不要硬编码 z-index，应依赖 `entry.zIndex` 传递的层级

## Reusable Patterns

- **命令式 Portal 弹窗模式**：`openDialog(Comp, props) → Promise<T>`，将 UI 交互 Promise 化，适合需要等待用户决策的流程
- **Promise 化弹窗交互模式**：`resolve/reject` 注入 Store，关闭时由 Store 触发 Promise 完成，解耦调用方与弹窗组件
- **z-index 分层管理模式**：`nextZIndex += 1000` 自增策略，间隔 1000 为嵌套元素预留空间
- **onClose 单一桥接点**：Portal 与 Store 仅通过 `onClose` 通信，弹窗组件无需感知 Store 存在
- **closeAll 路由切换清理**：在 `__root.tsx` 监听路由变化调用 `closeAll()`，统一清理所有弹窗
