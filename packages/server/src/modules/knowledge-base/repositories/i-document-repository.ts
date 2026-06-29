import type { Document, Prisma } from '@prisma/client'
import type { DocCreateData, DocUpdateData } from './document.repository.js'

export interface IDocumentRepository {
  findByKbId(kbId: string, folderId?: string | null): Promise<Document[]>
  findByIdAndKb(id: string, kbId: string): Promise<Document | null>
  findById(id: string): Promise<Document | null>
  findManyByKbIdWithPagination(
    kbId: string,
    folderId: string | null,
    orderBy: Prisma.DocumentOrderByWithRelationInput | Prisma.DocumentOrderByWithRelationInput[],
    skip: number,
    take: number,
  ): Promise<Document[]>
  countByKbId(kbId: string, folderId: string | null): Promise<number>
  updateStatus(
    id: string,
    status: Prisma.DocumentUpdateInput['status'],
    errorMessage?: string | null,
  ): Promise<Document>
  deleteByKbId(kbId: string): Promise<Prisma.BatchPayload>
  create(data: DocCreateData): Promise<Document>
  update(id: string, data: DocUpdateData): Promise<Document>
  searchByKbName(kbId: string, keyword: string, limit: number): Promise<Document[]>
  deleteChunksByDocumentId(documentId: string): Promise<Prisma.BatchPayload>
}
