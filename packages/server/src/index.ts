import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { applyHelmet } from './middleware/helmet.js'
import { applyCors } from './middleware/cors.js'
import {
  authRateLimit,
  chatRateLimit,
  uploadRateLimit,
  generalRateLimit,
} from './middleware/rate-limit.js'
import { sanitizeError } from './utils/sanitize-error.js'
import { auth } from './auth.js'
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

  // 1. 全局错误处理（脱敏）
  app.onError(sanitizeError)

  // 2. Helmet 安全头
  applyHelmet(app)

  // 3. CORS 硬化
  applyCors(app)

  // 4. 通用限速（兜底）
  app.use('*', generalRateLimit)

  // 5. 认证路由独立限速（覆盖通用限速）
  app.use('/api/auth/*', authRateLimit)

  // 6. 聊天路由限速
  app.use('/chat', chatRateLimit)

  // 7. 上传路由限速
  app.use('/knowledge-bases/:id/files', uploadRateLimit)

  // 8. 健康检查（最小化信息）
  app.get('/health', (c) => c.json({ status: 'ok' }))

  // 9. Better Auth handler 挂载
  app.on(['POST', 'GET'], '/api/auth/**', (c) => auth.handler(c.req.raw))

  // 10. 业务路由
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
