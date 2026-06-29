import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../processors/database/prisma.service.js'
import type { PaginationResult } from '../interfaces/paginator.interface.js'
import { TransactionCapable } from './transaction-capable.js'

export interface RepositoryOptions {
  page?: number
  size?: number
  orderBy?: Record<string, 'asc' | 'desc'>
}

@Injectable()
export abstract class BaseRepository<T, CreateInput, UpdateInput> {
  protected abstract readonly modelName: keyof PrismaService
  protected readonly tx: TransactionCapable

  constructor(protected readonly prisma: PrismaService) {
    this.tx = new TransactionCapable(prisma)
  }

  protected get model() {
    return this.prisma[this.modelName] as unknown as {
      findMany: (args: unknown) => Promise<T[]>
      findUnique: (args: unknown) => Promise<T | null>
      findFirst: (args: unknown) => Promise<T | null>
      create: (args: { data: CreateInput }) => Promise<T>
      update: (args: { where: Record<string, unknown>; data: UpdateInput }) => Promise<T>
      delete: (args: { where: Record<string, unknown> }) => Promise<T>
      deleteMany: (args: { where?: Record<string, unknown> }) => Promise<{ count: number }>
      count: (args?: { where?: Record<string, unknown> }) => Promise<number>
      paginate: <A>(
        args: A,
        options: { page: number; size: number },
      ) => Promise<PaginationResult<T>>
      exists: (args: { where: Record<string, unknown> }) => Promise<boolean>
    }
  }

  async findAll(options?: RepositoryOptions): Promise<T[]> {
    const take = options?.size ?? 100
    return this.model.findMany({
      orderBy: options?.orderBy,
      take,
    })
  }

  async findById(id: string): Promise<T | null> {
    return this.model.findUnique({ where: { id } })
  }

  async create(data: CreateInput): Promise<T> {
    return this.model.create({ data })
  }

  async update(id: string, data: UpdateInput): Promise<T> {
    return this.model.update({ where: { id }, data })
  }

  async delete(id: string): Promise<T> {
    return this.model.delete({ where: { id } })
  }

  async paginate(
    where: Record<string, unknown>,
    options: {
      page: number
      size: number
      orderBy?: Record<string, 'asc' | 'desc'>
    },
  ): Promise<PaginationResult<T>> {
    return this.model.paginate(
      { where, orderBy: options.orderBy },
      { page: options.page, size: options.size },
    )
  }

  async exists(where: Record<string, unknown>): Promise<boolean> {
    return this.model.exists({ where })
  }
}
