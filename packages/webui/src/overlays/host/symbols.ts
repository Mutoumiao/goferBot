import type { InjectionKey } from 'vue'

export type OverlayCloseFn = () => void
export const OverlayCloseKey: InjectionKey<OverlayCloseFn> = Symbol('overlay:close')
