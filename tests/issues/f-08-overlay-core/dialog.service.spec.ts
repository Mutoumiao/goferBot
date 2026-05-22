import { describe, it, expect, beforeEach } from 'vitest'
import { openDialog, closeDialog, closeAllDialogs } from '@/overlays/services/dialog.service'
import { useOverlayHost } from '@/overlays/host/useOverlayHost'

const MockDialog = {} as any

describe('dialog.service', () => {
  beforeEach(() => {
    useOverlayHost().clearOverlays()
  })

  it('AC-04: should open dialog and return id', () => {
    const id = openDialog(MockDialog, { title: 'Test' })
    expect(id).toBeDefined()
    expect(useOverlayHost().overlays).toHaveLength(1)
    expect(useOverlayHost().overlays[0].type).toBe('dialog')
  })

  it('AC-04: should close dialog by id', () => {
    const id = openDialog(MockDialog, { title: 'Test' })
    closeDialog(id)
    expect(useOverlayHost().overlays).toHaveLength(0)
  })

  it('AC-04: should close all dialogs', () => {
    openDialog(MockDialog, { title: 'A' })
    openDialog(MockDialog, { title: 'B' })
    closeAllDialogs()
    expect(useOverlayHost().overlays).toHaveLength(0)
  })

  it('AC-13: closeAllDialogs should not affect context menus', () => {
    openDialog(MockDialog, { title: 'Dialog' })
    useOverlayHost().addOverlay({ component: MockDialog, props: {}, type: 'contextMenu' })
    closeAllDialogs()
    expect(useOverlayHost().overlays).toHaveLength(1)
    expect(useOverlayHost().overlays[0].type).toBe('contextMenu')
  })

  it('AC-04: closeDialog with non-existent id should be no-op', () => {
    openDialog(MockDialog, { title: 'Test' })
    closeDialog('non-existent-id')
    expect(useOverlayHost().overlays).toHaveLength(1)
  })
})
