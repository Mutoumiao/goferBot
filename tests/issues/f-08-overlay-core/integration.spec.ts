import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useOverlayHost } from '@/overlays/host/useOverlayHost'
import { openDialog } from '@/overlays/services/dialog.service'
import { openContextMenu } from '@/overlays/services/context-menu.service'

const MockComponent = {} as any

describe('overlay integration', () => {
  let cleanup: (() => void) | null = null

  beforeEach(() => {
    useOverlayHost().clearOverlays()
  })

  afterEach(() => {
    if (cleanup) {
      cleanup()
      cleanup = null
    }
  })

  it('AC-10: should clear all overlays on beforeunload', () => {
    openDialog(MockComponent, { title: 'Test' })
    openContextMenu(MockComponent, { x: 100, y: 200 })
    expect(useOverlayHost().overlays).toHaveLength(2)

    const handler = () => {
      const { clearOverlays } = useOverlayHost()
      clearOverlays()
    }
    window.addEventListener('beforeunload', handler)
    cleanup = () => window.removeEventListener('beforeunload', handler)

    window.dispatchEvent(new Event('beforeunload'))
    expect(useOverlayHost().overlays).toHaveLength(0)
  })

  it('AC-11: router beforeEach should clear all overlays', () => {
    openDialog(MockComponent, { title: 'Test' })
    openContextMenu(MockComponent, { x: 100, y: 200 })
    expect(useOverlayHost().overlays).toHaveLength(2)

    // 模拟路由守卫行为
    const { clearOverlays } = useOverlayHost()
    clearOverlays()

    expect(useOverlayHost().overlays).toHaveLength(0)
  })
})
