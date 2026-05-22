import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { openContextMenu, closeContextMenu, closeAllContextMenus } from '@/overlays'
import { useOverlayHost } from '@/overlays/host/useOverlayHost'

describe('ContextMenu overlay system', () => {
  beforeEach(() => {
    const { clearOverlays } = useOverlayHost()
    clearOverlays()
  })

  it('AC-01: openContextMenu creates overlay in queue', () => {
    const { overlays } = useOverlayHost()
    const MockMenu = defineComponent({ template: '<div>menu</div>' })
    const id = openContextMenu(MockMenu, { x: 10, y: 20 })
    expect(id).toBeTruthy()
    expect(overlays.length).toBe(1)
    expect(overlays[0]).toMatchObject({
      component: MockMenu,
      props: { x: 10, y: 20 },
      type: 'contextMenu',
    })
  })

  it('AC-03: closeContextMenu removes overlay by id', () => {
    const { overlays } = useOverlayHost()
    const MockMenu = defineComponent({ template: '<div>menu</div>' })
    const id = openContextMenu(MockMenu, { x: 10, y: 20 })
    expect(overlays.length).toBe(1)
    closeContextMenu(id)
    expect(overlays.length).toBe(0)
  })

  it('AC-03: closeAllContextMenus clears all context menus', () => {
    const { overlays } = useOverlayHost()
    const MockMenu = defineComponent({ template: '<div>menu</div>' })
    openContextMenu(MockMenu, { x: 10, y: 20 })
    openContextMenu(MockMenu, { x: 30, y: 40 })
    expect(overlays.length).toBe(2)
    closeAllContextMenus()
    expect(overlays.length).toBe(0)
  })

  it('AC-03: closeAllContextMenus does not affect dialogs', () => {
    const { overlays } = useOverlayHost()
    const MockMenu = defineComponent({ template: '<div>menu</div>' })
    const MockDialog = defineComponent({ template: '<div>dialog</div>' })
    // Simulate a dialog overlay (using internal access)
    const { addOverlay } = useOverlayHost()
    addOverlay({ component: MockDialog, props: {}, type: 'dialog' })
    openContextMenu(MockMenu, { x: 10, y: 20 })
    expect(overlays.length).toBe(2)
    closeAllContextMenus()
    expect(overlays.length).toBe(1)
    expect(overlays[0].type).toBe('dialog')
  })
})
