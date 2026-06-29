import { Global, Module } from '@nestjs/common'
import { TransactionManager } from '../../shared/repositories/transaction-manager.js'
import { PrismaService } from './prisma.service.js'

@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: () => new PrismaService(),
    },
    TransactionManager,
  ],
  exports: [PrismaService, TransactionManager],
})
@Global()
export class DatabaseModule {}
