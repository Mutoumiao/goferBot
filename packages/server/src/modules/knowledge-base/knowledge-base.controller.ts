import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { KnowledgeBaseService } from './knowledge-base.service.js'
import { CreateKbDto } from './dto/create-kb.dto.js'
import { UpdateKbDto } from './dto/update-kb.dto.js'

@Controller('knowledge-bases')
@UseGuards(JwtAuthGuard)
export class KnowledgeBaseController {
  constructor(private readonly kbService: KnowledgeBaseService) {}

  @Get()
  async list(@CurrentUser('id') userId: string) {
    const entries = await this.kbService.list(userId)
    return { entries, total: entries.length }
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateKbDto,
  ) {
    return this.kbService.create(userId, dto)
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateKbDto,
  ) {
    return this.kbService.update(userId, id, dto)
  }

  @Delete(':id')
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.kbService.remove(userId, id)
  }
}
