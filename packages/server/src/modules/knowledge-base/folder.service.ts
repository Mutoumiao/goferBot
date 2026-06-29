import { Injectable } from '@nestjs/common'
import type { CopyFolderDto } from './dto/copy-folder.dto.js'
import type { CreateFolderDto } from './dto/create-folder.dto.js'
import type { MoveFolderDto } from './dto/move-folder.dto.js'
import type { UpdateFolderDto } from './dto/update-folder.dto.js'
import { FolderMoveService } from './folder-move.service.js'
import { FolderTreeService } from './folder-tree.service.js'
import { KbCleanupService } from './kb-cleanup.service.js'

@Injectable()
export class FolderService {
  constructor(
    private readonly treeService: FolderTreeService,
    private readonly moveService: FolderMoveService,
    private readonly cleanupService: KbCleanupService,
  ) {}

  async list(userId: string, kbId: string, parentId?: string, sortBy?: string, sortOrder?: string) {
    return this.treeService.list(userId, kbId, parentId, sortBy, sortOrder)
  }

  async create(userId: string, kbId: string, dto: CreateFolderDto) {
    return this.treeService.create(userId, kbId, dto)
  }

  async update(userId: string, kbId: string, folderId: string, dto: UpdateFolderDto) {
    return this.treeService.update(userId, kbId, folderId, dto)
  }

  async remove(userId: string, kbId: string, folderId: string) {
    await this.treeService.remove(userId, kbId, folderId)
    await this.cleanupService.cleanupFolder(kbId, folderId)
    await this.moveService.deleteFolder(folderId)
    return { id: folderId, deleted: true }
  }

  async move(userId: string, kbId: string, folderId: string, dto: MoveFolderDto) {
    return this.moveService.move(userId, kbId, folderId, dto)
  }

  async copy(userId: string, kbId: string, folderId: string, dto: CopyFolderDto) {
    return this.moveService.copy(userId, kbId, folderId, dto)
  }

  async getBreadcrumbs(userId: string, kbId: string, folderId?: string) {
    return this.treeService.getBreadcrumbs(userId, kbId, folderId)
  }

  async findAncestors(userId: string, kbId: string, folderId: string) {
    await this.treeService.ensureOwnership(userId, kbId)
    return this.treeService.findAncestors(kbId, folderId)
  }

  async isDescendant(userId: string, kbId: string, ancestorId: string, descendantId: string) {
    await this.treeService.ensureOwnership(userId, kbId)
    return this.treeService.isDescendant(kbId, ancestorId, descendantId)
  }
}
