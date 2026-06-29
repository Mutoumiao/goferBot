import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../processors/database/prisma.service.js'

@Injectable()
export class TransactionManager {
  constructor(private readonly prisma: PrismaService) {}

  async run<R>(
    work: (tx: Prisma.TransactionClient) => Promise<R>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<R> {
    const maxWait = options?.maxWait ?? 5000
    const timeout = options?.timeout ?? 10000
    return this.prisma.$transaction(work, { maxWait, timeout }) as Promise<R>
  }

  async runBatch(
    operations: Array<(tx: Prisma.TransactionClient) => Promise<unknown> | unknown>,
  ): Promise<unknown[]> {
    return this.prisma.$transaction(operations) as Promise<unknown[]>
  }
}
