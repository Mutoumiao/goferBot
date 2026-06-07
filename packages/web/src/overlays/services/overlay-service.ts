import type { ComponentType } from 'react'
import { useOverlayStore } from '../host/overlay-store'

/**
 * 打开 Dialog — 返回 Promise，在 dialog 关闭时 resolve
 *
 * @example
 * ```ts
 * const result = await openDialog(ConfirmDialog, { title: '确认删除？' })
 * if (result === 'confirm') { ... }
 * ```
 */
export function openDialog<T = unknown>(
  component: ComponentType<any>,
  props?: Record<string, unknown>,
): Promise<T> {
  const store = useOverlayStore.getState()
  return new Promise<T>((resolve, reject) => {
    store.push({
      kind: 'dialog',
      component,
      props: props ?? {},
      resolve: (v) => resolve(v as T),
      reject,
    })
  })
}

/**
 * 关闭 Dialog（按 id）
 */
export function closeDialog(id: string, result?: unknown): void {
  useOverlayStore.getState().remove(id, result)
}

/**
 * 打开 ContextMenu — 在指定屏幕坐标弹出右键菜单
 */
export function openContextMenu<T = unknown>(
  component: ComponentType<any>,
  position: { x: number; y: number },
  props?: Record<string, unknown>,
): Promise<T> {
  const store = useOverlayStore.getState()
  return new Promise<T>((resolve, reject) => {
    store.push({
      kind: 'context-menu',
      component,
      props: props ?? {},
      position,
      resolve: (v) => resolve(v as T),
      reject,
    })
  })
}

/**
 * 关闭 ContextMenu（按 id）
 */
export function closeContextMenu(id: string, result?: unknown): void {
  useOverlayStore.getState().remove(id, result)
}

/**
 * 关闭所有 overlay
 */
export function closeAll(): void {
  useOverlayStore.getState().closeAll()
}
