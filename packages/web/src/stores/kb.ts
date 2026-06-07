import { create } from 'zustand'
import type { KbEntry } from '@goferbot/data'

interface KbState {
  entries: KbEntry[]
  isLoading: boolean
  selectedId: string | null

  setEntries: (entries: KbEntry[]) => void
  addEntry: (entry: KbEntry) => void
  removeEntry: (id: string) => void
  setIsLoading: (v: boolean) => void
  setSelectedId: (id: string | null) => void
}

export const useKbStore = create<KbState>((set) => ({
  entries: [],
  isLoading: false,
  selectedId: null,

  setEntries: (entries) => set({ entries }),
  addEntry: (entry) => set((s) => ({ entries: [...s.entries, entry] })),
  removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
  setIsLoading: (v) => set({ isLoading: v }),
  setSelectedId: (id) => set({ selectedId: id }),
}))
