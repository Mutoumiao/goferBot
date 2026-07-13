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
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { CompanionService } from './companion.service.js'
import { CompanionCareService } from './companion-care.service.js'
import {
  CompanionListQueryDto,
  CreateCompanionDto,
  GenerateCareEventDto,
  UpdateCarePlanDto,
  UpdateCompanionDto,
  UpdateCompanionStatusDto,
} from './dto/companion.dto.js'

@Controller('companions')
@UseGuards(JwtAuthGuard)
export class CompanionController {
  constructor(
    private readonly companionService: CompanionService,
    private readonly careService: CompanionCareService,
  ) {}

  @Post()
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateCompanionDto) {
    return this.companionService.create(userId, dto)
  }

  @Get()
  async list(@CurrentUser('id') userId: string, @Query() query: CompanionListQueryDto) {
    return this.companionService.list(userId, query)
  }

  /** 伴侣头像上传（须在 :id 路由之前） */
  @Post('avatar')
  async uploadAvatar(@CurrentUser('id') userId: string, @Req() req: FastifyRequest) {
    return this.companionService.uploadAvatar(userId, req)
  }

  @Get(':id')
  async detail(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.companionService.detail(userId, id)
  }

  @Put(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCompanionDto,
  ) {
    return this.companionService.update(userId, id, dto)
  }

  @Delete(':id')
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.companionService.remove(userId, id)
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCompanionStatusDto,
  ) {
    return this.companionService.updateStatus(userId, id, dto)
  }

  // ---- Care Plan ----

  @Get(':id/care-plan')
  async getCarePlan(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.careService.getPlan(userId, id)
  }

  @Patch(':id/care-plan')
  async updateCarePlan(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCarePlanDto,
  ) {
    return this.careService.updatePlan(userId, id, dto)
  }

  @Post(':id/care-events/generate')
  async generateCareEvent(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: GenerateCareEventDto,
  ) {
    return this.careService.generate(userId, id, dto)
  }
}
