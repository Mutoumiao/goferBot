import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service.js'

@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: () => new PrismaService(),
    },
  ],
  exports: [PrismaService],
})
@Global()
export class DatabaseModule {}
