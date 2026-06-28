import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { UserModule } from '../modules/user/user.module.js'
import { StorageModule } from '../processors/storage/storage.module.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { AuthRedisService } from './auth-redis.service.js'
import { PasswordEncryptionService } from './crypto/password-encryption.service.js'
import { AuthRepository } from './repositories/auth.repository.js'
import { JwtStrategy } from './strategies/jwt.strategy.js'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '2h',
        },
      }),
      inject: [ConfigService],
    }),
    UserModule,
    StorageModule,
  ],
  providers: [
    AuthService,
    AuthRepository,
    PasswordEncryptionService,
    JwtStrategy,
    AuthRedisService,
  ],
  controllers: [AuthController],
  exports: [AuthService, AuthRepository, AuthRedisService],
})
export class AuthModule {}
