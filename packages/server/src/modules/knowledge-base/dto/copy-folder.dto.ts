import { copyFolderRequestSchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class CopyFolderDto extends createZodDto(copyFolderRequestSchema) {}
