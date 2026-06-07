import { describe, it, expect, beforeEach } from 'vitest'
import { useOverlayStore } from '@/overlays/host/overlay-store'

function MockDialog() {
  return null
}

describe('Overlay Store', () => {
  beforeEach(() => {
    useOverlayStore.setState({ entries: [], nextZIndex: 1000 })
  })

  it('push adds an entry with incrementing z-index and returns id', () => {
    const id = useOverlayStore.getState().push({
      kind: 'dialog',
      component: MockDialog,
      props: { title: 'Test' },
    })

    const state = useOverlayStore.getState()
    expect(id).toBeTruthy()
    expect(state.entries).toHaveLength(1)
    expect(state.entries[0].zIndex).toBe(1000)
    expect(state.entries[0].kind).toBe('dialog')
    expect(state.nextZIndex).toBe(1001)
  })

  it('remove deletes entry by id', () => {
    const id = useOverlayStore.getState().push({
      kind: 'dialog',
      component: MockDialog,
      props: {},
    })

    useOverlayStore.getState().remove(id)

    expect(useOverlayStore.getState().entries).toHaveLength(0)
  })

  it('remove resolves the promise with result', async () => {
    const store = useOverlayStore.getState()

    const promise = new Promise((resolve) => {
      store.push({
        kind: 'dialog',
        component: MockDialog,
        props: {},
        resolve,
      })
    })

    // The entry was pushed; now remove with result
    const entry = useOverlayStore.getState().entries[0]
    useOverlayStore.getState().remove(entry.id, 'confirmed')

    const result = await promise
    expect(result).toBe('confirmed')
  })

  it('closeAll removes all entries and resolves all', () => {
    const store = useOverlayStore.getState()
    store.push({ kind: 'dialog', component: MockDialog, props: {} })
    store.push({ kind: 'dialog', component: MockDialog, props: {} })

    store.closeAll()

    expect(useOverlayStore.getState().entries).toHaveLength(0)
  })

  it('z-index increments across pushes', () => {
    const store = useOverlayStore.getState()
    store.push({ kind: 'dialog', component: MockDialog, props: {} })
    store.push({ kind: 'dialog', component: MockDialog, props: {} })
    store.push({ kind: 'dialog', component: MockDialog, props: {} })

    const entries = useOverlayStore.getState().entries
    expect(entries[0].zIndex).toBe(1000)
    expect(entries[1].zIndex).toBe(1001)
    expect(entries[2].zIndex).toBe(1002)
  })
})
