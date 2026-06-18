/**
 * 开发环境端口清理脚本
 * 功能：强制释放前后端开发端口，处理各种异常残留场景
 * 适用场景：命令行崩溃、Agent异常退出、进程僵死等
 */

const { execSync } = require('node:child_process')

const PORTS = [3000, 5173]

function killPort(port) {
  console.log(`[kill-port] Checking port ${port}...`)

  try {
    if (process.platform === 'win32') {
      // Windows: 先查找占用端口的进程
      const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      })

      const lines = result.trim().split('\n').filter(Boolean)
      const pids = [
        ...new Set(
          lines
            .map((line) => {
              const parts = line.trim().split(/\s+/)
              return parts[parts.length - 1] // PID 在最后一列
            })
            .filter((pid) => pid && pid !== '0'),
        ),
      ]

      if (pids.length === 0) {
        console.log(`[kill-port] Port ${port} is already free`)
        return
      }

      pids.forEach((pid) => {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' })
          console.log(`[kill-port] Killed PID ${pid} on port ${port}`)
        } catch {
          console.log(`[kill-port] Failed to kill PID ${pid}, may already exited`)
        }
      })
    } else {
      // macOS/Linux
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' })
      console.log(`[kill-port] Cleaned port ${port}`)
    }
  } catch {
    // netstat/lsof 找不到进程 = 端口空闲
    console.log(`[kill-port] Port ${port} is already free`)
  }
}

// 主逻辑
console.log('[kill-port] Starting port cleanup...')
PORTS.forEach(killPort)
console.log('[kill-port] Done')
