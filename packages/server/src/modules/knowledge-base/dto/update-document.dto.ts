import { createZodDto } from 'nestjs-zod'
import { updateDocumentRequestSchema } from '@goferbot/data/schemas'

export class UpdateDocumentDto extends createZodDto(updateDocumentRequestSchema) {
  declare name?: string
  declare folderId?: string | null
}