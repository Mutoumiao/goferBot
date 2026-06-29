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
import { CompanionService } from './companion.service.js'
import {
  CompanionListQueryDto,
  CreateCompanionDto,
  UpdateCompanionDto,
  UpdateCompanionStatusDto,
} from './dto/companion.dto.js'

@Controller('companions')
@UseGuards(JwtAuthGuard)
export class CompanionController {
  constructor(private readonly companionService: CompanionService) {}

  @Post()
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateCompanionDto) {
    return this.companionService.create(userId, dto)
  }

  @Get()
  async list(@CurrentUser('id') userId: string, @Query() query: CompanionListQueryDto) {
    return this.companionService.list(userId, query)
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
}
