import { moveDocumentRequestSchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class MoveDocumentDto extends createZodDto(moveDocumentRequestSchema) {}
