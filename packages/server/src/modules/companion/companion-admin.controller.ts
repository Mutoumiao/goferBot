import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { RequirePermission } from '../../auth/decorators/permission.decorator.js'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { PermissionGuard } from '../../auth/guards/permission.guard.js'
import { CompanionAdminService } from './companion-admin.service.js'
import {
  CreateAdminCompanionDto,
  UpdateAdminCompanionDto,
  UpdateCompanionStatusDto,
} from './dto/companion.dto.js'

@Controller('admin/companions')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CompanionAdminController {
  constructor(private readonly adminService: CompanionAdminService) {}

  @Get()
  @RequirePermission('companions:read')
  async list(
    @Query('status') status?: 'draft' | 'published' | 'archived',
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    return this.adminService.list({
      status,
      page: page ? Number(page) : undefined,
      size: size ? Number(size) : undefined,
    })
  }

  @Post()
  @RequirePermission('companions:write')
  async create(@Body() dto: CreateAdminCompanionDto) {
    return this.adminService.create(dto)
  }

  @Post('avatar')
  @RequirePermission('companions:write')
  async uploadAvatar(@Req() req: FastifyRequest) {
    return this.adminService.uploadAvatar(req)
  }

  @Get(':id')
  @RequirePermission('companions:read')
  async detail(@Param('id') id: string) {
    return this.adminService.detail(id)
  }

  @Put(':id')
  @RequirePermission('companions:write')
  async update(@Param('id') id: string, @Body() dto: UpdateAdminCompanionDto) {
    return this.adminService.update(id, dto)
  }

  @Patch(':id/status')
  @RequirePermission('companions:write')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateCompanionStatusDto) {
    return this.adminService.updateStatus(id, dto)
  }

  /** 删除 = 归档 */
  @Delete(':id')
  @RequirePermission('companions:write')
  async archive(@Param('id') id: string) {
    return this.adminService.archive(id)
  }
}
