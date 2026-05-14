import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { getAppDataDir } from './utils.js'
import chatRoutes from './routes/chat.js'
import sessionRoutes from './routes/sessions.js'
import knowledgeBaseRoutes from './routes/knowledgeBases.js'
import settingsRoutes from './routes/settings.js'
import { syncKnowledgeBasesFromDisk } from './sync.js'
import { loadVectorExtensions } from './db.js'
import db from './db.js'

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
        const address = server.address()
        const actualPort = typeof address === 'object' && address !== null ? address.port : port
        server.close(() => resolve(actualPort))
      })
      server.listen(port, '127.0.0.1')
    }
    tryPort(startPort, MAX_PORT_ATTEMPTS)
  })
}

async function main(): Promise<void> {
  const envPort = process.env.KB_PORT ? parseInt(process.env.KB_PORT, 10) : undefined
  const startPort = envPort !== undefined && !isNaN(envPort) ? envPort : DEFAULT_PORT

  syncKnowledgeBasesFromDisk()

  // 启动时加载 sqlite-vec 扩展并创建虚拟表
  await loadVectorExtensions()

  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_document_chunks USING vec0(
        chunk_id TEXT PRIMARY KEY,
        embedding FLOAT[1536]
      );
    `)
  } catch (e) {
    console.warn('[db] vec_document_chunks creation skipped (sqlite-vec may not be available):', (e as Error).message)
  }

  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS fts_document_chunks USING fts5(
        content,
        file_path,
        chunk_id,
        tokenize='unicode61'
      );
    `)
  } catch (e) {
    console.warn('[db] fts_document_chunks creation skipped:', (e as Error).message)
  }

  const app = new Hono()

  app.onError((err, c) => {
    console.error('Hono error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  })

  app.use('*', async (c, next) => {
    c.header('Access-Control-Allow-Origin', '*')
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    c.header('Access-Control-Allow-Headers', 'Content-Type')
    if (c.req.method === 'OPTIONS') {
      return c.body(null, 204)
    }
    await next()
  })

  app.get('/health', (c) => {
    return c.json({ status: 'ok', cors: 'manual-v2' })
  })

  app.route('/chat', chatRoutes)
  app.route('/sessions', sessionRoutes)
  app.route('/knowledge-bases', knowledgeBaseRoutes)
  app.route('/settings', settingsRoutes)

  const onListening = (info: { port: number }) => {
    writePortFile(info.port)
    console.log(`Sidecar running on http://127.0.0.1:${info.port}`)
  }

  if (startPort === 0) {
    // OS assigns a random port directly — avoids TOCTOU race in findAvailablePort
    serve({
      fetch: app.fetch,
      port: 0,
      hostname: '127.0.0.1',
    }, onListening)
  } else {
    const port = await findAvailablePort(startPort)
    serve({
      fetch: app.fetch,
      port,
      hostname: '127.0.0.1',
    }, onListening)
  }
}

main().catch((err) => {
  console.error('Failed to start sidecar:', err)
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})
