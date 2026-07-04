import { Module } from '@nestjs/common'
import { AuthRedisService } from './auth-redis.service.js'
import { AuthRepository } from './repositories/auth.repository.js'

@Module({
  providers: [AuthRepository, AuthRedisService],
  exports: [AuthRepository, AuthRedisService],
})
export class AuthRepositoryModule {}
