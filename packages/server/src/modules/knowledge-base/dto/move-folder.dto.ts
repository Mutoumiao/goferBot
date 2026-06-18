import { moveFolderRequestSchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class MoveFolderDto extends createZodDto(moveFolderRequestSchema) {}
