import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service.js'
import { AuthController } from './auth.controller.js'
import { PasswordEncryptionService } from './crypto/password-encryption.service.js'
import { JwtStrategy } from './strategies/jwt.strategy.js'
import { UserModule } from '../modules/user/user.module.js'
import { StorageModule } from '../processors/storage/storage.module.js'

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
  ],
  providers: [AuthService, PasswordEncryptionService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
