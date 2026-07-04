import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import { ConfigService } from '@nestjs/config'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { RequestContextMiddleware } from './common/middleware/request-context.middleware.js'
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js'
import { setAllowedHostnames } from './common/utils/ssrf-guard.js'
import { SuperAdminBootstrapService } from './modules/user/services/super-admin-bootstrap.service.js'

export function logLevelToNestLevels(
  level: string,
): ('log' | 'error' | 'warn' | 'debug' | 'verbose')[] {
  switch (level) {
    case 'debug':
      return ['log', 'error', 'warn', 'debug', 'verbose']
    case 'info':
      return ['log', 'error', 'warn']
    case 'warn':
      return ['error', 'warn']
    case 'error':
      return ['error']
    default:
      return ['log', 'error', 'warn']
  }
}

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

  // 0.5 Super Admin Bootstrap
  const superAdminBootstrap = app.get(SuperAdminBootstrapService)
  await superAdminBootstrap.bootstrap()

  // 1. Helmet 安全头
  await app.register(helmet, {
    contentSecurityPolicy: false, // API 不需要 CSP
    hsts: process.env.NODE_ENV === 'production',
  })

  // 1.5 Cookie 插件（用于 HttpOnly Cookie 认证）
  await app.register(cookie, {
    secret: configService.get<string>('JWT_SECRET'), // 用于签名 cookie
    parseOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    },
  })

  // 1.6 Multipart 文件上传
  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
      files: 10,
    },
    throwFileSizeLimit: true,
  })

  // 2. CORS（白名单 origin）
  const envOrigins = (configService.get<string>('CORS_ORIGIN') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || envOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('Not allowed by CORS'), false)
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'X-Requested-With', 'X-Request-Id', 'X-App-Context'],
    credentials: true,
  })

  // 3. 全局前缀（排除健康检查）
  app.setGlobalPrefix('api', {
    exclude: ['/health'],
  })

  // 3.5 RequestId 中间件（使用 Fastify onRequest hook 避免依赖 @fastify/middie）
  const fastifyInstance = app.getHttpAdapter().getInstance()
  const requestIdMw = new RequestIdMiddleware()
  const requestContextMw = new RequestContextMiddleware()
  fastifyInstance.addHook('onRequest', (req, _reply, done) => {
    requestIdMw.use(req as any, _reply as any, () => {
      requestContextMw.use(req as any, _reply as any, done)
    })
  })

  // 注意：LoggingInterceptor 已在 AppModule 通过 APP_INTERCEPTOR 注册，此处不再重复注册

  // Graceful shutdown
  app.enableShutdownHooks()
}
