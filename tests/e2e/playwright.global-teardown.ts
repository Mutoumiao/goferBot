import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { cleanupDatabase } from './fixtures/database'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PID_FILE = path.resolve(__dirname, '.e2e-backend.pid')

export default async function globalTeardown() {
  // 关闭由 globalSetup 启动的后端进程
  if (fs.existsSync(PID_FILE)) {
    const pid = fs.readFileSync(PID_FILE, 'utf-8').trim()
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' })
      } else {
        process.kill(-Number(pid), 'SIGTERM')
      }
      console.log(`[E2E] Backend process ${pid} terminated`)
    } catch {
      console.log(`[E2E] Backend process ${pid} already exited`)
    } finally {
      fs.unlinkSync(PID_FILE)
    }
  }

  // 清理 E2E 数据库
  try {
    await cleanupDatabase()
    console.log('[E2E] Database cleaned up')
  } catch (err) {
    console.error('[E2E] Database cleanup failed:', err)
  }

  if (process.env.CI) {
    console.log('[E2E] CI mode: shutting down docker infrastructure...')
    execSync('pnpm infra:down', { stdio: 'inherit' })
  } else {
    console.log('[E2E] Local mode: keeping docker running for reuse')
  }
}
