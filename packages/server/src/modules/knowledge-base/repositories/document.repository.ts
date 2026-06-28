import { Injectable } from '@nestjs/common'
import type { Document, Prisma } from '@prisma/client'
import { BaseRepository } from '../../../shared/repositories/base.repository.js'

export type DocCreateData = {
  kbId: string
  folderId?: string | null
  name: string
  ext?: string | null
  mimeType?: string | null
  size?: bigint | null
  storageKey: string
  status?: string
}

export type DocUpdateData = Partial<
  Pick<
    Document,
    | 'kbId'
    | 'folderId'
    | 'name'
    | 'ext'
    | 'mimeType'
    | 'size'
    | 'storageKey'
    | 'status'
    | 'errorMessage'
  >
>

@Injectable()
export class DocumentRepository extends BaseRepository<Document, DocCreateData, DocUpdateData> {
  protected readonly modelName = 'document' as const

  private get docModel() {
    return this.prisma.document
  }

  async findByKbId(kbId: string, folderId?: string | null): Promise<Document[]> {
    const where: Prisma.DocumentWhereInput = { kbId }
    if (folderId !== undefined) {
      where.folderId = folderId ?? null
    }
    return this.docModel.findMany({ where })
  }

  async findByIdAndKb(id: string, kbId: string): Promise<Document | null> {
    return this.docModel.findFirst({ where: { id, kbId } })
  }

  async findById(id: string): Promise<Document | null> {
    return this.docModel.findUnique({ where: { id } })
  }

  async findManyByKbIdWithPagination(
    kbId: string,
    folderId: string | null,
    orderBy: Prisma.DocumentOrderByWithRelationInput | Prisma.DocumentOrderByWithRelationInput[],
    skip: number,
    take: number,
  ): Promise<Document[]> {
    return this.docModel.findMany({
      where: { kbId, folderId: folderId ?? null },
      orderBy,
      skip,
      take,
    })
  }

  async countByKbId(kbId: string, folderId: string | null): Promise<number> {
    return this.docModel.count({
      where: { kbId, folderId: folderId ?? null },
    })
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
    return this.docModel.update({ where: { id }, data })
  }

  async deleteByKbId(kbId: string): Promise<Prisma.BatchPayload> {
    return this.docModel.deleteMany({ where: { kbId } })
  }

  async create(data: DocCreateData): Promise<Document> {
    return this.docModel.create({ data: data as unknown as Prisma.DocumentUncheckedCreateInput })
  }

  async update(id: string, data: DocUpdateData): Promise<Document> {
    const cleaned = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    ) as Prisma.DocumentUncheckedUpdateInput
    return this.docModel.update({ where: { id }, data: cleaned })
  }

  async searchByKbName(kbId: string, keyword: string, limit: number): Promise<Document[]> {
    return this.docModel.findMany({
      where: { kbId, name: { contains: keyword, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async deleteChunksByDocumentId(documentId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.chunk.deleteMany({ where: { documentId } })
  }
}
