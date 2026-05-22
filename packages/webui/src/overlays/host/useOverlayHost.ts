import { reactive, markRaw } from 'vue'
import type { OverlayItem } from '../types/overlay.types'

const overlays = reactive<OverlayItem[]>([])

export function useOverlayHost() {
  function addOverlay(item: Omit<OverlayItem, 'id'>): string {
    const id = crypto.randomUUID()
    overlays.push({ ...item, id, component: markRaw(item.component) })
    return id
  }

  function removeOverlay(id: string): void {
    const index = overlays.findIndex(o => o.id === id)
    if (index > -1) {
      overlays.splice(index, 1)
    }
  }

  function clearOverlays(type?: OverlayItem['type']): void {
    if (type) {
      for (let i = overlays.length - 1; i >= 0; i--) {
        if (overlays[i].type === type) {
          overlays.splice(i, 1)
        }
      }
    } else {
      overlays.splice(0, overlays.length)
    }
  }

  return {
    overlays,
    addOverlay,
    removeOverlay,
    clearOverlays,
  }
}
