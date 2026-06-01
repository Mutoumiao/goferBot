import { Injectable, OnModuleInit } from '@nestjs/common'
import type {
  IVectorStore,
  VectorRecord,
  VectorSearchOptions,
  VectorSearchResult,
} from '@goferbot/rag-sdk'
import { PrismaService } from '../database/prisma.service.js'
import { PgVectorStore } from '../../vector/pgvector.js'

@Injectable()
export class VectorService implements IVectorStore, OnModuleInit {
  private readonly store: PgVectorStore

  constructor(private readonly prisma: PrismaService) {
    this.store = new PgVectorStore(prisma)
  }

  async onModuleInit(): Promise<void> {
    await this.store.ensureCollection()
  }

  async ensureCollection(): Promise<void> {
    return this.store.ensureCollection()
  }

  async insertVectors(vectors: VectorRecord[]): Promise<void> {
    return this.store.insertVectors(vectors)
  }

  async searchVectors(
    queryVector: number[],
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]> {
    return this.store.searchVectors(queryVector, options)
  }

  async deleteByIds(ids: string[]): Promise<void> {
    return this.store.deleteByIds(ids)
  }
}
