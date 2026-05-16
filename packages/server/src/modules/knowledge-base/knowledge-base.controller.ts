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
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { KnowledgeBaseService } from './knowledge-base.service.js'
import { CreateKbDto, createKbSchema } from './dto/create-kb.dto.js'
import { UpdateKbDto, updateKbSchema } from './dto/update-kb.dto.js'

@Controller('api/knowledge-bases')
@UseGuards(JwtAuthGuard)
export class KnowledgeBaseController {
  constructor(private readonly kbService: KnowledgeBaseService) {}

  @Get()
  async list(@CurrentUser('id' as never) userId: string) {
    return this.kbService.list(userId)
  }

  @Post()
  async create(
    @CurrentUser('id' as never) userId: string,
    @Body(new ZodValidationPipe(createKbSchema)) dto: CreateKbDto,
  ) {
    return this.kbService.create(userId, dto)
  }

  @Patch(':id')
  async update(
    @CurrentUser('id' as never) userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateKbSchema)) dto: UpdateKbDto,
  ) {
    return this.kbService.update(userId, id, dto)
  }

  @Delete(':id')
  async remove(
    @CurrentUser('id' as never) userId: string,
    @Param('id') id: string,
  ) {
    return this.kbService.remove(userId, id)
  }
}
