import { getShell } from '@/shell'
import { HttpBackendTransport } from './http-transport'
import type { BackendTransport } from './types'

let backend: BackendTransport | null = null
let overrideBackend: BackendTransport | null = null

export function getBackend(): BackendTransport {
  if (overrideBackend) return overrideBackend
  if (!backend) {
    const shell = getShell()
    backend = new HttpBackendTransport(shell)
  }
  return backend
}

export function setBackend(b: BackendTransport | null): void {
  overrideBackend = b
}

export function resetBackend(): void {
  backend?.dispose()
  backend = null
  overrideBackend = null
}

export * from './types'
export { HttpBackendTransport } from './http-transport'
export { FakeBackendTransport } from './fake-transport'
