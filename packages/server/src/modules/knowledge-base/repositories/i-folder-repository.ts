import type { Folder } from '@prisma/client'

export interface IFolderRepository {
  findByKbId(kbId: string, parentId?: string | null): Promise<Folder[]>
  findByIdAndKb(id: string, kbId: string): Promise<Folder | null>
  hasChildren(id: string): Promise<boolean>
  searchByKbName(kbId: string, keyword: string, limit: number): Promise<Folder[]>
}
