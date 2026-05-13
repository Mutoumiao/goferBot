import { spawn, ChildProcess } from 'child_process'
import { tmpdir } from 'os'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

let sidecarProcess: ChildProcess | null = null
let currentDataDir: string | null = null

function waitForPortFile(dir: string, timeout = 30000): Promise<number> {
  const portFile = join(dir, '.sidecar-port')
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const check = () => {
      if (existsSync(portFile)) {
        const content = readFileSync(portFile, 'utf-8').trim()
        const port = parseInt(content, 10)
        if (!isNaN(port) && port > 0) {
          resolve(port)
          return
        }
      }
      if (Date.now() - start > timeout) {
        reject(new Error('Timeout waiting for sidecar port file'))
        return
      }
      setTimeout(check, 100)
    }
    check()
  })
}

export async function startSidecar(): Promise<{ port: number; dataDir: string }> {
  currentDataDir = mkdtempSync(join(tmpdir(), 'kb-e2e-'))
  sidecarProcess = spawn('node', ['server/dist/index.js'], {
    env: {
      ...process.env,
      KB_DATA_DIR: currentDataDir,
      KB_PORT: '0',
    },
    stdio: 'pipe',
  })

  sidecarProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[sidecar stdout] ${data.toString().trim()}`)
  })

  sidecarProcess.stderr?.on('data', (data: Buffer) => {
    console.error(`[sidecar stderr] ${data.toString().trim()}`)
  })

  const port = await waitForPortFile(currentDataDir)
  return { port, dataDir: currentDataDir }
}

export async function stopSidecar(): Promise<void> {
  if (sidecarProcess) {
    sidecarProcess.kill('SIGTERM')
    await new Promise<void>((resolve) => {
      sidecarProcess!.on('exit', () => resolve())
      sidecarProcess!.on('close', () => resolve())
    })
    sidecarProcess = null
  }

  if (currentDataDir) {
    rmSync(currentDataDir, { recursive: true, force: true })
    currentDataDir = null
  }
}

export function getSidecarProcess(): ChildProcess | null {
  return sidecarProcess
}
