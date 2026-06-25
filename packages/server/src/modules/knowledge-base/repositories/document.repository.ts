import { Injectable } from '@nestjs/common'
import type { Document, Prisma } from '@prisma/client'
import { BaseRepository } from '../../../shared/repositories/base.repository.js'

export type DocumentCreateInput = Prisma.DocumentCreateInput
export type DocumentUpdateInput = Prisma.DocumentUpdateInput

@Injectable()
export class DocumentRepository extends BaseRepository<
  Document,
  DocumentCreateInput,
  DocumentUpdateInput
> {
  protected readonly modelName = 'document' as const

  async findByKbId(kbId: string, folderId?: string | null): Promise<Document[]> {
    const where: Prisma.DocumentWhereInput = { kbId }
    if (folderId !== undefined) {
      where.folderId = folderId ?? null
    }
    return this.model.findMany({ where })
  }

  async findByIdAndKb(id: string, kbId: string): Promise<Document | null> {
    return this.model.findFirst({ where: { id, kbId } })
  }

  async updateStatus(
    id: string,
    status: Prisma.DocumentUpdateInput['status'],
    errorMessage?: string | null,
  ): Promise<Document> {
    const data: Prisma.DocumentUpdateInput = { status }
    if (errorMessage !== undefined) {
      data.errorMessage = errorMessage
    }
    return this.model.update({ where: { id }, data })
  }

  async deleteByKbId(kbId: string): Promise<Prisma.BatchPayload> {
    return this.model.deleteMany({ where: { kbId } })
  }
}
