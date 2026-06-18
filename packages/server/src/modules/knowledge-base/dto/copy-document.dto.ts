import { copyDocumentRequestSchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class CopyDocumentDto extends createZodDto(copyDocumentRequestSchema) {}
