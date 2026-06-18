import { updateFolderRequestSchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class UpdateFolderDto extends createZodDto(updateFolderRequestSchema) {}
