import { createZodDto } from 'nestjs-zod'
import { createDocumentRequestSchema } from '@goferbot/data/schemas'

export class CreateDocumentDto extends createZodDto(createDocumentRequestSchema) {}
