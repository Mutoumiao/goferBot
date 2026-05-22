import { describe, it, expect, beforeEach } from 'vitest'
import { useOverlayHost } from '@/overlays/host/useOverlayHost'

const MockComponent = {} as any

describe('useOverlayHost', () => {
  beforeEach(() => {
    useOverlayHost().clearOverlays()
  })

  it('AC-01: should start with empty overlays array', () => {
    const { overlays } = useOverlayHost()
    expect(overlays).toHaveLength(0)
  })

  it('AC-02: should add overlay and return id', () => {
    const { overlays, addOverlay } = useOverlayHost()
    const id = addOverlay({
      component: MockComponent,
      props: {},
      type: 'dialog'
    })
    expect(id).toBeDefined()
    expect(overlays).toHaveLength(1)
    expect(overlays[0].id).toBe(id)
    expect(overlays[0].type).toBe('dialog')
  })

  it('AC-03: should remove overlay by id', () => {
    const { overlays, addOverlay, removeOverlay } = useOverlayHost()
    const id = addOverlay({ component: MockComponent, props: {}, type: 'dialog' })
    removeOverlay(id)
    expect(overlays).toHaveLength(0)
  })

  it('AC-04: should clear all overlays', () => {
    const { overlays, addOverlay, clearOverlays } = useOverlayHost()
    addOverlay({ component: MockComponent, props: {}, type: 'dialog' })
    addOverlay({ component: MockComponent, props: {}, type: 'contextMenu' })
    clearOverlays()
    expect(overlays).toHaveLength(0)
  })

  it('AC-13: should clear only dialog overlays when type is dialog', () => {
    const { overlays, addOverlay, clearOverlays } = useOverlayHost()
    addOverlay({ component: MockComponent, props: {}, type: 'dialog' })
    addOverlay({ component: MockComponent, props: {}, type: 'contextMenu' })
    clearOverlays('dialog')
    expect(overlays).toHaveLength(1)
    expect(overlays[0].type).toBe('contextMenu')
  })

  it('AC-13: should clear only contextMenu overlays when type is contextMenu', () => {
    const { overlays, addOverlay, clearOverlays } = useOverlayHost()
    addOverlay({ component: MockComponent, props: {}, type: 'dialog' })
    addOverlay({ component: MockComponent, props: {}, type: 'contextMenu' })
    clearOverlays('contextMenu')
    expect(overlays).toHaveLength(1)
    expect(overlays[0].type).toBe('dialog')
  })
})
