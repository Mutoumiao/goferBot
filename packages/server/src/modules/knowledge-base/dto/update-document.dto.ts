import { updateDocumentRequestSchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class UpdateDocumentDto extends createZodDto(updateDocumentRequestSchema) {}
