import {
  closeAll,
  closeContextMenu,
  closeDialog,
  openContextMenu,
  openDialog,
} from '../services/overlay-service'

/**
 * Overlay 命令式调用 hook
 *
 * @example
 * ```tsx
 * const overlay = useOverlay()
 * overlay.dialog(ConfirmDialog, { title: '确认？' }).then(console.log)
 * ```
 */
export function useOverlay() {
  return {
    dialog: openDialog,
    closeDialog,
    contextMenu: openContextMenu,
    closeContextMenu,
    closeAll,
  } as const
}
