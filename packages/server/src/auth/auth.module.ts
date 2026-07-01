import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { UserModule } from '../modules/user/user.module.js'
import { StorageModule } from '../processors/storage/storage.module.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { AuthRedisService } from './auth-redis.service.js'
import { AuthRepositoryModule } from './auth-repository.module.js'
import { CaptchaController } from './captcha.controller.js'
import { CaptchaService } from './captcha.service.js'
import { CookieHelper } from './cookie.helper.js'
import { PasswordEncryptionService } from './crypto/password-encryption.service.js'
import { UserPasswordChangedListener } from './listeners/user-password-changed.listener.js'
import { UserStatusChangedListener } from './listeners/user-status-changed.listener.js'
import { PermissionGuard } from './guards/permission.guard.js'
import { PermissionService } from './services/permission.service.js'
import { JwtStrategy } from './strategies/jwt.strategy.js'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '15m',
        },
      }),
      inject: [ConfigService],
    }),
    UserModule,
    StorageModule,
    AuthRepositoryModule,
  ],
  providers: [
    AuthService,
    PasswordEncryptionService,
    JwtStrategy,
    AuthRedisService,
    CaptchaService,
    CookieHelper,
    UserPasswordChangedListener,
    UserStatusChangedListener,
    PermissionService,
    PermissionGuard,
  ],
  controllers: [AuthController, CaptchaController],
  exports: [AuthService, AuthRedisService, CaptchaService, PermissionService, PermissionGuard],
})
export class AuthModule {}
