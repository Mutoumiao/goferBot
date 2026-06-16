import { createZodDto } from 'nestjs-zod'
import { createFolderRequestSchema } from '@goferbot/data/schemas'

export class CreateFolderDto extends createZodDto(createFolderRequestSchema) {}
