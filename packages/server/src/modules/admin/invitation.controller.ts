import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { RequirePermission } from '../../auth/decorators/permission.decorator.js'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { PermissionGuard } from '../../auth/guards/permission.guard.js'
import { CreateInvitationDto, InvitationListQueryDto } from './dto/invitation.dto.js'
import { AuditService } from './services/audit.service.js'
import { InvitationService } from './services/invitation.service.js'

@Controller('admin/invitations')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InvitationController {
  constructor(
    private readonly invitationService: InvitationService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequirePermission('invitations:read')
  async list(@Query() query: InvitationListQueryDto) {
    return this.invitationService.list(query)
  }

  @Post()
  @RequirePermission('invitations:create')
  async create(@Body() dto: CreateInvitationDto, @CurrentUser('id') userId: string) {
    const result = await this.invitationService.create({ ...dto, createdBy: userId })
    await this.auditService.log({
      actor: userId,
      operation: 'invitation.create',
      target: 'invitation',
      targetId: result.id,
      metadata: { type: dto.type, note: dto.note },
    })
    return result
  }

  @Post(':id/revoke')
  @RequirePermission('invitations:update')
  async revoke(@Param('id') id: string, @CurrentUser('id') userId: string) {
    const result = await this.invitationService.revoke(id)
    await this.auditService.log({
      actor: userId,
      operation: 'invitation.revoke',
      target: 'invitation',
      targetId: id,
    })
    return result
  }

  @Delete(':id')
  @RequirePermission('invitations:delete')
  async delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    const result = await this.invitationService.delete(id)
    await this.auditService.log({
      actor: userId,
      operation: 'invitation.delete',
      target: 'invitation',
      targetId: id,
    })
    return result
  }
}
