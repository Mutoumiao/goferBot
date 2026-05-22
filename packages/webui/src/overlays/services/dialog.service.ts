import type { Component } from 'vue'
import { useOverlayHost } from '../host/useOverlayHost'
import type { DialogBaseProps } from '../types/overlay.types'

export function openDialog<TProps extends DialogBaseProps>(
  component: Component,
  props: TProps,
): string {
  const { addOverlay } = useOverlayHost()
  return addOverlay({ component, props, type: 'dialog' })
}

export function closeDialog(id: string): void {
  const { removeOverlay } = useOverlayHost()
  removeOverlay(id)
}

export function closeAllDialogs(): void {
  const { clearOverlays } = useOverlayHost()
  clearOverlays('dialog')
}
