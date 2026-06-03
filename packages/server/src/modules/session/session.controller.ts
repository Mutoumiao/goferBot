import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt.guard.js'
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { SessionService } from './session.service.js'
import { PagerDto } from '../../shared/dto/pager.dto.js'
import { CreateSessionDto, createSessionSchema } from './dto/create-session.dto.js'
import { UpdateSessionDto, updateSessionSchema } from './dto/update-session.dto.js'

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  async list(@CurrentUser('id') userId: string, @Query() query: PagerDto) {
    return this.sessionService.list(userId, {
      page: query.page,
      limit: query.size,
    })
  }

  @Get(':id')
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.sessionService.findOne(userId, id)
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSessionDto,
  ) {
    return this.sessionService.create(userId, dto)
  }

  @Post(':id/rename')
  @HttpCode(200)
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.sessionService.update(userId, id, dto)
  }

  @Delete(':id')
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.sessionService.remove(userId, id)
  }
}
