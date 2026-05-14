import { inject, provide } from 'vue'
import type { Shell } from './types'
export type { Shell, Unlisten } from './types'
export { MemoryShell } from './memory'
export type { MemoryShellOptions } from './memory'
import { TauriShell } from './tauri'
import { BrowserShell } from './browser'

const SHELL_KEY = Symbol('shell')

export function isTauri(): boolean {
  if (typeof window === 'undefined') return false
  if ('__TAURI_INTERNALS__' in window) return true
  if ('__TAURI__' in window) return true
  return false
}

export function createShell(): Shell {
  if (isTauri()) {
    return new TauriShell()
  }
  return new BrowserShell()
}

export function provideShell(shell: Shell) {
  provide(SHELL_KEY, shell)
}

export function useShell(): Shell {
  const shell = inject<Shell>(SHELL_KEY)
  if (!shell) {
    throw new Error('useShell() must be called inside a component with provideShell()')
  }
  return shell
}

// 测试注入支持
let overrideShell: Shell | null = null

export function setShell(shell: Shell | null) {
  overrideShell = shell
}

export function getShell(): Shell {
  if (overrideShell) return overrideShell
  return createShell()
}
