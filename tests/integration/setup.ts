import { spawn, ChildProcess } from 'child_process'
import { tmpdir } from 'os'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

let sidecarProcess: ChildProcess | null = null
let dataDir: string | null = null

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
  dataDir = mkdtempSync(join(tmpdir(), 'kb-e2e-'))
  console.log('[setup] dataDir:', dataDir)
  sidecarProcess = spawn('node', ['server/dist/index.js'], {
    env: {
      ...process.env,
      KB_DATA_DIR: dataDir,
      KB_PORT: '0',
    },
    stdio: 'pipe',
  })

  sidecarProcess.stdout?.on('data', (d) => console.log('[sidecar]', d.toString().trim()))
  sidecarProcess.stderr?.on('data', (d) => console.error('[sidecar]', d.toString().trim()))

  console.log('[setup] waiting for port file...')
  const port = await waitForPortFile(dataDir)
  console.log('[setup] got port:', port)
  return { port, dataDir }
}

export async function stopSidecar(): Promise<void> {
  if (sidecarProcess) {
    sidecarProcess.kill()
    await new Promise((resolve) => sidecarProcess!.once('exit', resolve))
    sidecarProcess = null
  }
  if (dataDir) {
    rmSync(dataDir, { recursive: true, force: true })
    dataDir = null
  }
}
