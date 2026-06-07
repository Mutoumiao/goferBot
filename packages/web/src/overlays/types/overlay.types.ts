import type { ComponentType } from 'react'

export type OverlayKind = 'dialog' | 'context-menu'

export interface OverlayEntry {
  id: string
  kind: OverlayKind
  /** React 组件 */
  component: ComponentType<any>
  /** 传给组件的 props */
  props: Record<string, unknown>
  /** z-index 层级，自增 */
  zIndex: number
  /** 右键菜单的屏幕坐标 */
  position?: { x: number; y: number }
  /** dialog close 时 resolve 的 Promise resolver */
  resolve?: (value: unknown) => void
  /** dialog close 时 reject 的 Promise rejecter */
  reject?: (reason: unknown) => void
}

export interface OverlayState {
  entries: OverlayEntry[]
  nextZIndex: number

  /** 入队 overlay */
  push: (entry: Omit<OverlayEntry, 'id' | 'zIndex'>) => string
  /** 出队 overlay（按 id） */
  remove: (id: string, result?: unknown) => void
  /** 关闭全部 overlay */
  closeAll: () => void
}
