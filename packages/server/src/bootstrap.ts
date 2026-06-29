import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import { ConfigService } from '@nestjs/config'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js'
import { RequestContextMiddleware } from './common/middleware/request-context.middleware.js'
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js'
import { setAllowedHostnames } from './common/utils/ssrf-guard.js'

export async function bootstrap(app: NestFastifyApplication) {
  const configService = app.get(ConfigService)

  // 注入 SSRF 白名单（支持通过环境变量扩展 LLM Provider）
  const ssrfAllowedHosts = configService.get<string>('SSRF_ALLOWED_HOSTNAMES')
  if (ssrfAllowedHosts) {
    setAllowedHostnames(
      ssrfAllowedHosts
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean),
    )
  }

  // 1. Helmet 安全头
  await app.register(helmet, {
    contentSecurityPolicy: false, // API 不需要 CSP
    hsts: process.env.NODE_ENV === 'production',
  })

  // 1.5 Multipart 文件上传
  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
      files: 10,
    },
    throwFileSizeLimit: true,
  })

  // 2. CORS（白名单 origin）
  const isProduction = process.env.NODE_ENV === 'production'
  const envOrigin = configService.get<string>('CORS_ORIGIN')
  const allowedOrigins = isProduction
    ? envOrigin
      ? [envOrigin]
      : []
    : [
        'http://localhost:1420',
        'http://localhost:1421',
        'tauri://localhost',
        'http://localhost:3000',
        'http://localhost:5173',
        ...(envOrigin ? [envOrigin] : []),
      ]

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('Not allowed by CORS'), false)
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'X-Request-Id'],
    credentials: true,
  })

  // 3. 全局前缀（排除健康检查）
  app.setGlobalPrefix('api', {
    exclude: ['/health'],
  })

  // 3.5 RequestId 中间件
  app.use(new RequestIdMiddleware().use)

  // 3.6 RequestContext 中间件（AsyncLocalStorage 隐式传递上下文）
  app.use(new RequestContextMiddleware().use)

  // 4. 日志拦截器（生产与开发环境均启用，内部自行区分行为模式）
  app.useGlobalInterceptors(new LoggingInterceptor())

  // Graceful shutdown
  app.enableShutdownHooks()
}
