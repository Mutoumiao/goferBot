import { createZodDto } from 'nestjs-zod'
import { updateFolderRequestSchema } from '@goferbot/data/schemas'

export class UpdateFolderDto extends createZodDto(updateFolderRequestSchema) {}
