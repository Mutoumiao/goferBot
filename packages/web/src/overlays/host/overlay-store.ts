import { create } from 'zustand'
import type { OverlayEntry, OverlayState } from '../types/overlay.types'

let idCounter = 0
function genId(): string {
  return `overlay-${++idCounter}-${Date.now()}`
}

export const useOverlayStore = create<OverlayState>((set, get) => ({
  entries: [],
  nextZIndex: 1000,

  push: (entry) => {
    const id = genId()
    const zIndex = get().nextZIndex
    const fullEntry: OverlayEntry = { ...entry, id, zIndex }
    set((s) => ({
      entries: [...s.entries, fullEntry],
      nextZIndex: s.nextZIndex + 1,
    }))
    return id
  },

  remove: (id, result) => {
    const entry = get().entries.find((e) => e.id === id)
    if (entry?.resolve) entry.resolve(result)
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }))
  },

  closeAll: () => {
    for (const e of get().entries) e.resolve?.(undefined)
    set({ entries: [] })
  },
}))
