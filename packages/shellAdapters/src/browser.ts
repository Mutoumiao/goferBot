import type { Shell, Unlisten } from './types'

function getBrowserPort(): number {
  const stored = localStorage.getItem('sidecar-port')
  if (stored) {
    const parsed = parseInt(stored, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  const envPort = (import.meta as any).env?.VITE_SIDECAR_PORT
  if (envPort) {
    const parsed = parseInt(envPort, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return 11451
}

export class BrowserShell implements Shell {
  private port = getBrowserPort()

  async getSidecarPort(): Promise<number | null> {
    return this.port
  }

  async onSidecarReady(handler: (payload: { port: number }) => void): Promise<Unlisten> {
    // 浏览器模式下端口已固定，立即触发
    setTimeout(() => handler({ port: this.port }), 0)
    return () => {}
  }

  async onSidecarRestarted(handler: (payload: { port: number }) => void): Promise<Unlisten> {
    // 浏览器模式下不监听重启事件
    return () => {}
  }

  async restartSidecar(): Promise<void> {
    // 浏览器模式下无操作
    console.warn('[BrowserShell] restartSidecar is a no-op in browser mode')
  }

  async importFiles(knowledgeBaseId: string, targetPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.accept = '.txt,.md,.markdown'

      input.onchange = async () => {
        const files = input.files
        if (!files || files.length === 0) {
          resolve()
          return
        }

        const fileList: { name: string; content: string }[] = []
        for (const file of Array.from(files)) {
          const content = await file.text()
          fileList.push({ name: file.name, content })
        }

        try {
          const res = await fetch(`http://127.0.0.1:${this.port}/knowledge-bases/${knowledgeBaseId}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: targetPath, files: fileList }),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: '导入失败' }))
            reject(new Error(err.error || '导入失败'))
          } else {
            resolve()
          }
        } catch (e) {
          reject(e)
        }
      }

      input.click()
    })
  }
}
