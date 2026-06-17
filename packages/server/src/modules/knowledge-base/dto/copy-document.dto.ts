import { createZodDto } from 'nestjs-zod'
import { copyDocumentRequestSchema } from '@goferbot/data/schemas'

export class CopyDocumentDto extends createZodDto(copyDocumentRequestSchema) {}
