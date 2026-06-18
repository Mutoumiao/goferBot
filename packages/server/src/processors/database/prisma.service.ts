import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'
import type { PaginationResult } from '../../shared/interfaces/paginator.interface.js'

// 扩展 PrismaClient 类型
type ExtendedPrismaClient = ReturnType<typeof createExtendedPrismaClient>

function createExtendedPrismaClient(options?: Prisma.PrismaClientOptions) {
  const client = new PrismaClient(options)

  return client.$extends({
    model: {
      $allModels: {
        async paginate<T, A>(
          this: T,
          x: Prisma.Exact<
            A,
            Pick<Prisma.Args<T, 'findFirst'>, 'where' | 'select' | 'include' | 'orderBy'>
          >,
          options: { page: number; size: number },
        ): Promise<PaginationResult<Prisma.Result<T, A, 'findFirst'>>> {
          if (typeof x !== 'object' || x === null) {
            return {
              data: [],
              pagination: {
                total: 0,
                size: 0,
                totalPage: 0,
                currentPage: 0,
                hasNextPage: false,
                hasPrevPage: false,
              },
            } as PaginationResult<any>
          }

          const { page, size: perPage } = options
          const skip = page > 0 ? perPage * (page - 1) : 0
          const countArgs = (x as any).where ? { where: (x as any).where } : {}

          const [total, data] = await Promise.all([
            (this as any).count(countArgs),
            (this as any).findMany({
              ...(x as any),
              take: perPage,
              skip,
            }),
          ])

          const lastPage = Math.ceil(total / perPage)

          return {
            data,
            pagination: {
              total,
              size: perPage,
              totalPage: lastPage,
              currentPage: page,
              hasNextPage: page < lastPage,
              hasPrevPage: page > 1,
            },
          } as PaginationResult<any>
        },

        async exists<T, A>(
          this: T,
          x: Prisma.Exact<A, Pick<Prisma.Args<T, 'findFirst'>, 'where'>>,
        ): Promise<boolean> {
          if (typeof x !== 'object' || x === null || !('where' in x)) {
            return false
          }
          const count = await (this as any).count({ where: (x as any).where })
          return count > 0
        },
      },
    },
  })
}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client: ExtendedPrismaClient

  constructor(options?: Prisma.PrismaClientOptions) {
    this.client = createExtendedPrismaClient(options)
  }

  async onModuleInit() {
    await this.client.$connect()
  }

  async onModuleDestroy() {
    await this.client.$disconnect()
  }

  // 代理所有 PrismaClient 方法
  get user() {
    return this.client.user
  }

  get session() {
    return this.client.session
  }

  get message() {
    return this.client.message
  }

  get knowledgeBase() {
    return this.client.knowledgeBase
  }

  get folder() {
    return this.client.folder
  }

  get document() {
    return this.client.document
  }

  get chunk() {
    return this.client.chunk
  }

  get setting() {
    return this.client.setting
  }

  // 通用代理方法
  $connect() {
    return this.client.$connect()
  }

  $disconnect() {
    return this.client.$disconnect()
  }

  $queryRaw(...args: any[]) {
    return (this.client as any).$queryRaw(...args)
  }

  $executeRaw(...args: any[]) {
    return (this.client as any).$executeRaw(...args)
  }

  $transaction(...args: any[]) {
    return (this.client as any).$transaction(...args)
  }
}
