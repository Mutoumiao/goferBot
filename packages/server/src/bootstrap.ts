import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { ConfigService } from '@nestjs/config'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js'
import { SpiderGuard } from './common/guards/spider.guard.js'

export async function bootstrap(app: NestFastifyApplication) {
  const configService = app.get(ConfigService)

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
  const allowedOrigins = [
    'http://localhost:1420',
    'tauri://localhost',
    'http://localhost:3000',
    'http://localhost:5173',
  ]

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('Not allowed by CORS'), false)
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })

  // 3. 全局前缀（排除健康检查）
  app.setGlobalPrefix('api', {
    exclude: ['/health'],
  })

  // 4. 开发环境日志拦截器
  if (process.env.NODE_ENV !== 'production') {
    app.useGlobalInterceptors(new LoggingInterceptor())
  }

  // 5. 爬虫防护（已在 AppModule 通过 APP_GUARD 注册，此处为双重保险）
  app.useGlobalGuards(new SpiderGuard())

  // Graceful shutdown
  app.enableShutdownHooks()
}
