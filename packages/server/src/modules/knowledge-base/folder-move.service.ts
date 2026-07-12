import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../processors/database/prisma.service.js'
import { TransactionManager } from '../../shared/repositories/transaction-manager.js'
import { DocumentMoveService } from './document-move.service.js'
import type { CopyFolderDto } from './dto/copy-folder.dto.js'
import type { MoveFolderDto } from './dto/move-folder.dto.js'
import { FolderTreeService } from './folder-tree.service.js'
import { KbCleanupService } from './kb-cleanup.service.js'

@Injectable()
export class FolderMoveService {
  private readonly logger = new Logger(FolderMoveService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionManager: TransactionManager,
    private readonly documentMoveService: DocumentMoveService,
    private readonly cleanupService: KbCleanupService,
    private readonly treeService: FolderTreeService,
  ) {}

  async move(userId: string, kbId: string, folderId: string, dto: MoveFolderDto) {
    await this.treeService.ensureOwnership(userId, kbId)
    const folder = await this.treeService.getById(userId, kbId, folderId)
    if (!folder) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '文件夹不存在' })
    }

    const targetKbId = dto.targetKbId ?? kbId
    const targetFolderId = dto.targetFolderId ?? null

    if (targetKbId !== kbId) {
      return this.moveCrossKb(userId, kbId, folderId, targetKbId, targetFolderId)
    }
    return this.moveWithinKb(folderId, kbId, targetFolderId)
  }

  private async moveWithinKb(folderId: string, kbId: string, targetFolderId: string | null) {
    if (targetFolderId !== null) {
      await this.treeService.assertNotSelfOrDescendant(kbId, folderId, targetFolderId)
    }

    return this.prisma.folder.update({
      where: { id: folderId },
      data: { kbId, parentId: targetFolderId },
    })
  }

  private async moveCrossKb(
    userId: string,
    srcKbId: string,
    folderId: string,
    targetKbId: string,
    targetFolderId: string | null,
  ) {
    await this.treeService.ensureOwnership(userId, targetKbId)

    if (targetFolderId !== null) {
      const targetFolder = await this.prisma.folder.findFirst({
        where: { id: targetFolderId, kbId: targetKbId },
      })
      if (!targetFolder) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: '目标文件夹不存在' })
      }
    }

    const copiedRoot = await this.copyTree(userId, srcKbId, folderId, targetKbId, targetFolderId)
    // cleanupFolder 已删除源文件夹及其子树，无需二次 delete
    await this.cleanupService.cleanupFolder(srcKbId, folderId)

    return copiedRoot
  }

  async copy(userId: string, kbId: string, folderId: string, dto: CopyFolderDto) {
    await this.treeService.ensureOwnership(userId, kbId)
    const folder = await this.treeService.getById(userId, kbId, folderId)
    if (!folder) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: '文件夹不存在' })
    }

    const targetKbId = dto.targetKbId ?? kbId
    if (targetKbId !== kbId) {
      await this.treeService.ensureOwnership(userId, targetKbId)
    }

    const targetFolderId = dto.targetFolderId ?? null
    if (targetFolderId !== null) {
      const targetFolder = await this.prisma.folder.findFirst({
        where: { id: targetFolderId, kbId: targetKbId },
      })
      if (!targetFolder) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: '目标文件夹不存在' })
      }
    }

    return this.copyTree(userId, kbId, folderId, targetKbId, targetFolderId)
  }

  private async copyTree(
    userId: string,
    srcKbId: string,
    srcFolderId: string,
    targetKbId: string,
    targetParentId: string | null,
  ) {
    const sourceRoot = await this.prisma.folder.findFirst({
      where: { id: srcFolderId, kbId: srcKbId },
    })
    if (!sourceRoot) throw new NotFoundException('源文件夹不存在')

    const folderMap = await this.copyFolderNodesInTransaction(
      sourceRoot.id,
      targetKbId,
      targetParentId,
    )

    const copiedFolderIds: string[] = []
    try {
      for (const [srcFolderId, copiedFolderId] of folderMap) {
        copiedFolderIds.push(copiedFolderId)
        await this.copyDocumentsInFolder(userId, srcKbId, srcFolderId, targetKbId, copiedFolderId)
      }
    } catch (err) {
      this.logger.warn(
        `文件夹复制失败，回滚已创建的 folder 树。targetKbId=${targetKbId} error=${err instanceof Error ? err.message : String(err)}`,
      )
      for (const id of copiedFolderIds) {
        await this.prisma.folder.delete({ where: { id } }).catch(() => {})
      }
      throw new BadRequestException({ code: 'COPY_FAILED', message: '文件夹复制失败，已回滚' })
    }

    const copiedRootId = folderMap.get(sourceRoot.id)
    if (!copiedRootId) throw new BadRequestException('文件夹复制失败')
    return this.prisma.folder.findUnique({ where: { id: copiedRootId } })
  }

  private async copyFolderNodesInTransaction(
    sourceRootId: string,
    targetKbId: string,
    targetParentId: string | null,
  ): Promise<Map<string, string>> {
    const folderMap = new Map<string, string>()
    await this.transactionManager.run(async (tx) => {
      const stack: Array<{ id: string; parentId: string | null }> = [
        { id: sourceRootId, parentId: targetParentId },
      ]

      while (stack.length > 0) {
        const item = stack.pop()
        if (!item) continue
        const { id: currentId, parentId: currentParentId } = item
        const sourceFolder = await tx.folder.findUnique({ where: { id: currentId } })
        if (!sourceFolder) continue

        const newName = await this.treeService.resolveUniqueFolderName(
          targetKbId,
          currentParentId,
          sourceFolder.name,
          tx,
        )
        const copiedFolder = await tx.folder.create({
          data: { kbId: targetKbId, parentId: currentParentId, name: newName },
        })
        folderMap.set(currentId, copiedFolder.id)

        const children = await tx.folder.findMany({
          where: { parentId: currentId },
          select: { id: true },
        })
        for (const child of children) {
          stack.push({ id: child.id, parentId: copiedFolder.id })
        }
      }
    })
    return folderMap
  }

  private async copyDocumentsInFolder(
    userId: string,
    srcKbId: string,
    srcFolderId: string,
    targetKbId: string,
    targetFolderId: string,
  ) {
    const docs = await this.prisma.document.findMany({
      where: { kbId: srcKbId, folderId: srcFolderId },
      select: { id: true },
    })

    for (const doc of docs) {
      await this.documentMoveService.copy(
        userId,
        srcKbId,
        doc.id,
        { targetKbId, targetFolderId },
        async () => {},
      )
    }
  }

  async deleteFolder(folderId: string) {
    await this.prisma.folder.delete({ where: { id: folderId } })
    return { id: folderId, deleted: true }
  }
}
