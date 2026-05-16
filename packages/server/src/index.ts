import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import chatRoutes from './routes/chat.js'
import sessionRoutes from './routes/sessions.js'
import knowledgeBaseRoutes from './routes/knowledgeBases.js'
import settingsRoutes from './routes/settings.js'

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000

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

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: '0.0.0.0',
}, (info) => {
  console.log(`Server running on http://0.0.0.0:${info.port}`)
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})
