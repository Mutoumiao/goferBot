import { createZodDto } from 'nestjs-zod'
import { copyFolderRequestSchema } from '@goferbot/data/schemas'

export class CopyFolderDto extends createZodDto(copyFolderRequestSchema) {}
