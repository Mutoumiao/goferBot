import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Shell, Unlisten } from './types'

export class TauriShell implements Shell {
  async getSidecarPort(): Promise<number | null> {
    try {
      return await invoke<number>('get_sidecar_port')
    } catch {
      return null
    }
  }

  async onSidecarReady(handler: (payload: { port: number }) => void): Promise<Unlisten> {
    return listen<{ port: number }>('sidecar-ready', (event) => {
      handler(event.payload)
    })
  }

  async onSidecarRestarted(handler: (payload: { port: number }) => void): Promise<Unlisten> {
    return listen<{ port: number }>('sidecar-restarted', (event) => {
      handler(event.payload)
    })
  }

  async restartSidecar(): Promise<void> {
    await invoke('restart_sidecar')
  }

  async importFiles(knowledgeBaseId: string, targetPath: string): Promise<void> {
    await invoke('import_files', { knowledgeBaseId, targetPath })
  }
}
