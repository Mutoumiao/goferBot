import type { Shell, Unlisten } from './types'

export interface MemoryShellOptions {
  initialPort?: number | null
  autoTriggerReady?: boolean
  autoTriggerRestarted?: boolean
}

export class MemoryShell implements Shell {
  private port: number | null
  private readyHandlers: Array<(payload: { port: number }) => void> = []
  private restartedHandlers: Array<(payload: { port: number }) => void> = []
  private restartCalled = false
  private importCalls: Array<{ knowledgeBaseId: string; targetPath: string }> = []

  constructor(options: MemoryShellOptions = {}) {
    this.port = options.initialPort ?? null
    if (options.autoTriggerReady && this.port !== null) {
      setTimeout(() => this.triggerReady(this.port!), 0)
    }
    if (options.autoTriggerRestarted && this.port !== null) {
      setTimeout(() => this.triggerRestarted(this.port!), 0)
    }
  }

  async getSidecarPort(): Promise<number | null> {
    return this.port
  }

  async onSidecarReady(handler: (payload: { port: number }) => void): Promise<Unlisten> {
    this.readyHandlers.push(handler)
    return () => {
      const idx = this.readyHandlers.indexOf(handler)
      if (idx !== -1) this.readyHandlers.splice(idx, 1)
    }
  }

  async onSidecarRestarted(handler: (payload: { port: number }) => void): Promise<Unlisten> {
    this.restartedHandlers.push(handler)
    return () => {
      const idx = this.restartedHandlers.indexOf(handler)
      if (idx !== -1) this.restartedHandlers.splice(idx, 1)
    }
  }

  async restartSidecar(): Promise<void> {
    this.restartCalled = true
  }

  async importFiles(knowledgeBaseId: string, targetPath: string): Promise<void> {
    this.importCalls.push({ knowledgeBaseId, targetPath })
  }

  // 测试控制方法
  triggerReady(port: number): void {
    this.port = port
    this.readyHandlers.forEach((h) => h({ port }))
  }

  triggerRestarted(port: number): void {
    this.port = port
    this.restartedHandlers.forEach((h) => h({ port }))
  }

  setPort(port: number | null): void {
    this.port = port
  }

  wasRestartCalled(): boolean {
    return this.restartCalled
  }

  getImportCalls(): Array<{ knowledgeBaseId: string; targetPath: string }> {
    return this.importCalls
  }
}
