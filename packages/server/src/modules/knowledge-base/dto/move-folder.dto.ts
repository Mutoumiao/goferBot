import { createZodDto } from 'nestjs-zod'
import { moveFolderRequestSchema } from '@goferbot/data/schemas'

export class MoveFolderDto extends createZodDto(moveFolderRequestSchema) {}
