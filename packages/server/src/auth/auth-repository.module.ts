import { Module } from '@nestjs/common'
import { AuthRepository } from './repositories/auth.repository.js'

@Module({
  providers: [AuthRepository],
  exports: [AuthRepository],
})
export class AuthRepositoryModule {}
