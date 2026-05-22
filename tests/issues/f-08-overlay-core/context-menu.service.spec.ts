import { describe, it, expect, beforeEach } from 'vitest'
import { openContextMenu, closeContextMenu, closeAllContextMenus } from '@/overlays/services/context-menu.service'
import { useOverlayHost } from '@/overlays/host/useOverlayHost'

const MockMenu = {} as any

describe('context-menu.service', () => {
  beforeEach(() => {
    useOverlayHost().clearOverlays()
  })

  it('AC-05: should open context menu and return id', () => {
    const id = openContextMenu(MockMenu, { x: 100, y: 200 })
    expect(id).toBeDefined()
    expect(useOverlayHost().overlays).toHaveLength(1)
    expect(useOverlayHost().overlays[0].type).toBe('contextMenu')
  })

  it('AC-05: should close context menu by id', () => {
    const id = openContextMenu(MockMenu, { x: 100, y: 200 })
    closeContextMenu(id)
    expect(useOverlayHost().overlays).toHaveLength(0)
  })

  it('AC-05: should close all context menus', () => {
    openContextMenu(MockMenu, { x: 100, y: 200 })
    openContextMenu(MockMenu, { x: 150, y: 250 })
    closeAllContextMenus()
    expect(useOverlayHost().overlays).toHaveLength(0)
  })

  it('AC-13: closeAllContextMenus should not affect dialogs', () => {
    useOverlayHost().addOverlay({ component: MockMenu, props: {}, type: 'dialog' })
    openContextMenu(MockMenu, { x: 100, y: 200 })
    closeAllContextMenus()
    expect(useOverlayHost().overlays).toHaveLength(1)
    expect(useOverlayHost().overlays[0].type).toBe('dialog')
  })
})
