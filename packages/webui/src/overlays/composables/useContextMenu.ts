import { ref, inject } from 'vue'
import { OverlayCloseKey } from '../host/symbols'

export function defineContextMenu() {
  const isOpen = ref(true)
  const closeOverlay = inject(OverlayCloseKey, () => {})

  function close() {
    isOpen.value = false
    closeOverlay()
  }

  return { isOpen, close }
}
