import type { Prisma } from '@prisma/client'
import type { PrismaService } from '../../processors/database/prisma.service.js'

const DEFAULT_MAX_WAIT = 5000
const DEFAULT_TIMEOUT = 10000

export class TransactionCapable {
  constructor(private readonly prisma: PrismaService) {}

  async run<R>(
    work: (tx: Prisma.TransactionClient) => Promise<R>,
    maxWait: number = DEFAULT_MAX_WAIT,
    timeout: number = DEFAULT_TIMEOUT,
  ): Promise<R> {
    return this.prisma.$transaction(work, { maxWait, timeout }) as Promise<R>
  }

  async runBatch(
    operations: Array<(tx: Prisma.TransactionClient) => Promise<unknown> | unknown>,
  ): Promise<unknown[]> {
    return this.prisma.$transaction(operations) as Promise<unknown[]>
  }
}
