import type { Component } from 'vue'

export interface OverlayItem {
  id: string
  component: Component
  props: Record<string, unknown>
  type: 'dialog' | 'contextMenu'
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
