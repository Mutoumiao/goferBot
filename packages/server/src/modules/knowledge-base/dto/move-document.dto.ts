import { createZodDto } from 'nestjs-zod'
import { moveDocumentRequestSchema } from '@goferbot/data/schemas'

export class MoveDocumentDto extends createZodDto(moveDocumentRequestSchema) {}
