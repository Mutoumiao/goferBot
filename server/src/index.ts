import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { getAppDataDir } from './utils.js'
import chatRoutes from './routes/chat.js'
import sessionRoutes from './routes/sessions.js'

const DEFAULT_PORT = 11451
const MAX_PORT_ATTEMPTS = 100

function writePortFile(port: number): void {
  const portFile = path.join(getAppDataDir(), '.sidecar-port')
  fs.writeFileSync(portFile, String(port), 'utf-8')
}

function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    function tryPort(port: number, attempts: number): void {
      if (attempts <= 0) {
        reject(new Error('No available port found'))
        return
      }
      const server = net.createServer()
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          tryPort(port + 1, attempts - 1)
        } else {
          reject(err)
        }
      })
      server.once('listening', () => {
        server.close(() => resolve(port))
      })
      server.listen(port, '127.0.0.1')
    }
    tryPort(startPort, MAX_PORT_ATTEMPTS)
  })
}

async function main(): Promise<void> {
  const port = await findAvailablePort(DEFAULT_PORT)
  writePortFile(port)

  const app = new Hono()

  app.get('/health', (c) => {
    return c.json({ status: 'ok' })
  })

  app.route('/chat', chatRoutes)
  app.route('/sessions', sessionRoutes)

  serve({
    fetch: app.fetch,
    port,
    hostname: '127.0.0.1',
  })

  console.log(`Sidecar running on http://127.0.0.1:${port}`)
}

main().catch((err) => {
  console.error('Failed to start sidecar:', err)
  process.exit(1)
})
