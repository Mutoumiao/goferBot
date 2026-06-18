import { createDocumentRequestSchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class CreateDocumentDto extends createZodDto(createDocumentRequestSchema) {}
