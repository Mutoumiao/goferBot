import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type {
  IVectorStore,
  VectorRecord,
  VectorSearchOptions,
  VectorSearchResult,
} from '../../interfaces/IVectorStore.js'
import { MilvusVectorStore } from '../../vector/milvus.js'

@Injectable()
export class VectorService implements IVectorStore, OnModuleInit {
  private readonly store: MilvusVectorStore

  constructor(private readonly config: ConfigService) {
    this.store = new MilvusVectorStore({
      host: this.config.getOrThrow<string>('MILVUS_HOST'),
      port: this.config.getOrThrow<string>('MILVUS_PORT'),
      collectionName: this.config.getOrThrow<string>('MILVUS_COLLECTION'),
      vectorDim: this.config.getOrThrow<number>('MILVUS_VECTOR_DIM'),
    })
  }

  async onModuleInit(): Promise<void> {
    await this.store.checkHealth()
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

  async deleteByFileId(fileId: string): Promise<void> {
    return this.store.deleteByFileId(fileId)
  }

  async deleteByKbId(kbId: string): Promise<void> {
    return this.store.deleteByKbId(kbId)
  }
}
