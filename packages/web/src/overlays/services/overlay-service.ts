import type { ComponentType } from 'react'
import { useOverlayStore } from '../host/overlay-store'

// biome-ignorelint: suspicious/noExplicitAny: ComponentType<any> 用于兼容不同 Dialog 的 Props 结构
type AnyComponent = ComponentType<any>

/**
 * 打开 Dialog — 返回 Promise，在 dialog 关闭时 resolve
 *
 * @example
 * ```ts
 * const result = await openDialog(ConfirmDialog, { title: '确认删除？' })
 * if (result === 'confirm') { ... }
 * ```
 */
export function openDialog<TResult = unknown, TProps extends object = Record<string, unknown>>(
  component: AnyComponent,
  props: TProps = {} as TProps,
): Promise<TResult> {
  const store = useOverlayStore.getState()
  return new Promise<TResult>((resolve, reject) => {
    store.push({
      kind: 'dialog',
      component,
      props: props as Record<string, unknown>,
      resolve: (v) => resolve(v as TResult),
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
export function openContextMenu<TResult = unknown, TProps extends object = Record<string, unknown>>(
  component: AnyComponent,
  position: { x: number; y: number },
  props: TProps = {} as TProps,
): Promise<TResult> {
  const store = useOverlayStore.getState()
  return new Promise<TResult>((resolve, reject) => {
    store.push({
      kind: 'context-menu',
      component,
      props: props as Record<string, unknown>,
      position,
      resolve: (v) => resolve(v as TResult),
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
