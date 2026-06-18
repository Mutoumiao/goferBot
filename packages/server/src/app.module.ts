import { Module } from '@nestjs/common'
import {
  APP_INTERCEPTOR,
  APP_FILTER,
  APP_GUARD,
  APP_PIPE,
} from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { HealthModule } from './modules/health/health.module.js'
import { UserModule } from './modules/user/user.module.js'
import { AuthModule } from './auth/auth.module.js'
import { VectorModule } from './processors/vector/vector.module.js'
import { KeywordModule } from './processors/keyword/keyword.module.js'
import { QueueModule } from './processors/queue/queue.module.js'
import { StorageModule } from './processors/storage/storage.module.js'
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module.js'
import { SessionModule } from './modules/session/session.module.js'
import { ChatModule } from './modules/chat/chat.module.js'
import { SettingsModule } from './modules/settings/settings.module.js'
import { AdminModule } from './modules/admin/admin.module.js'
import { RagModule } from './modules/rag/rag.module.js'
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js'
import { AllExceptionsFilter } from './common/filters/all-exception.filter.js'
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe.js'
import { SpiderGuard } from './common/guards/spider.guard.js'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60000,
          limit: 60,
        },
      ],
      // 非生产环境（开发 / E2E）跳过限流：本地批量请求与重复登录测试不再被 429。
      // skipIf 在 ThrottlerGuard 最先执行，故 @Throttle() 装饰的接口（如 auth 的 5 次/分）一并豁免。
      skipIf: () => process.env.NODE_ENV !== 'production',
    }),
    HealthModule,
    UserModule,
    AuthModule,
    VectorModule,
    KeywordModule,
    QueueModule.forRoot(),
    StorageModule,
    KnowledgeBaseModule,
    SessionModule,
    ChatModule,
    SettingsModule,
    AdminModule,
    RagModule,
  ],
  providers: [
    // 全局响应拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    // 全局日志拦截器（开发环境内部静默）
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // 全局异常过滤器
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    // 全局 Zod 验证管道
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    // 全局速率限制守卫
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // 全局爬虫防护守卫
    {
      provide: APP_GUARD,
      useClass: SpiderGuard,
    },
  ],
})
export class AppModule {}
