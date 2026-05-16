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
import { SessionService } from './session.service.js'
import { CreateSessionDto, createSessionSchema } from './dto/create-session.dto.js'
import { UpdateSessionDto, updateSessionSchema } from './dto/update-session.dto.js'

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  async list(@CurrentUser('id' as never) userId: string) {
    return this.sessionService.list(userId)
  }

  @Get(':id')
  async findOne(
    @CurrentUser('id' as never) userId: string,
    @Param('id') id: string,
  ) {
    return this.sessionService.findOne(userId, id)
  }

  @Post()
  async create(
    @CurrentUser('id' as never) userId: string,
    @Body(new ZodValidationPipe(createSessionSchema)) dto: CreateSessionDto,
  ) {
    return this.sessionService.create(userId, dto)
  }

  @Patch(':id')
  async update(
    @CurrentUser('id' as never) userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSessionSchema)) dto: UpdateSessionDto,
  ) {
    return this.sessionService.update(userId, id, dto)
  }

  @Delete(':id')
  async remove(
    @CurrentUser('id' as never) userId: string,
    @Param('id') id: string,
  ) {
    return this.sessionService.remove(userId, id)
  }
}
