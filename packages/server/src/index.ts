import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import chatRoutes from './routes/chat.js'
import sessionRoutes from './routes/sessions.js'
import knowledgeBaseRoutes from './routes/knowledgeBases.js'
import settingsRoutes from './routes/settings.js'
import jobRoutes from './routes/jobs.js'
import { checkRedisConnection } from './queue/redis.js'
import './queue/workers.js'

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000

async function main() {
  try {
    await checkRedisConnection()
    console.log('Redis connection established')
  } catch (err) {
    console.error('Failed to start server:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }

  const app = new Hono()

  app.onError((err, c) => {
    console.error('Hono error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  })

  app.use('*', cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    credentials: true,
  }))

  app.get('/health', (c) => c.json({ status: 'ok' }))

  app.route('/chat', chatRoutes)
  app.route('/sessions', sessionRoutes)
  app.route('/knowledge-bases', knowledgeBaseRoutes)
  app.route('/settings', settingsRoutes)
  app.route('/jobs', jobRoutes)

  serve({
    fetch: app.fetch,
    port: PORT,
    hostname: '0.0.0.0',
  }, (info) => {
    console.log(`Server running on http://0.0.0.0:${info.port}`)
  })
}

main()

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})
