import type { Component } from 'vue'
import { useOverlayHost } from '../host/useOverlayHost'
import type { ContextMenuBaseProps } from '../types/overlay.types'

export function openContextMenu<TProps extends ContextMenuBaseProps>(
  component: Component,
  props: TProps,
): string {
  const { addOverlay } = useOverlayHost()
  return addOverlay({ component, props, type: 'contextMenu' })
}

export function closeContextMenu(id: string): void {
  const { removeOverlay } = useOverlayHost()
  removeOverlay(id)
}

export function closeAllContextMenus(): void {
  const { clearOverlays } = useOverlayHost()
  clearOverlays('contextMenu')
}
