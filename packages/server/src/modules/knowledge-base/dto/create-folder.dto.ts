import { createFolderRequestSchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class CreateFolderDto extends createZodDto(createFolderRequestSchema) {}
