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
  UseGuards,
} from '@nestjs/common'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import {
  CompanionListQueryDto,
  CreateCompanionDto,
  UpdateCompanionDto,
  UpdateCompanionStatusDto,
} from './dto/companion.dto.js'
import { CompanionRepository } from './repositories/companion.repository.js'

@Controller('companions')
@UseGuards(JwtAuthGuard)
export class CompanionController {
  constructor(private readonly companionRepo: CompanionRepository) {}

  @Post()
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateCompanionDto) {
    const companion = await this.companionRepo.create({
      ...dto,
      user: { connect: { id: userId } },
      status: 'draft',
      lastAssistantMessage: dto.openingMessage ?? '',
    })

    return {
      id: companion.id,
      name: companion.name,
      headline: companion.headline,
      status: companion.status,
      createdAt: companion.createdAt,
    }
  }

  @Get()
  async list(@CurrentUser('id') userId: string, @Query() query: CompanionListQueryDto) {
    const result = await this.companionRepo.findByUserId(userId, {
      status: query.status,
      page: query.page ?? 1,
      size: query.size ?? 20,
    })

    return { items: result.data, pagination: result.pagination }
  }

  @Get(':id')
  async detail(@CurrentUser('id') userId: string, @Param('id') id: string) {
    const companion = await this.companionRepo.findByIdAndAuthorize(id, userId)
    return companion
  }

  @Put(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCompanionDto,
  ) {
    await this.companionRepo.findByIdAndAuthorize(id, userId)
    return this.companionRepo.update(id, dto)
  }

  @Delete(':id')
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.companionRepo.softDelete(id, userId)
    return { success: true }
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCompanionStatusDto,
  ) {
    await this.companionRepo.findByIdAndAuthorize(id, userId)
    return this.companionRepo.update(id, { status: dto.status })
  }
}
