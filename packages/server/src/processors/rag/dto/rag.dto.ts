import { createZodDto } from 'nestjs-zod'
import { ragIndexSchema, ragQuerySchema, ragRetrieveSchema } from './rag.schema.js'

export class RagRetrieveDto extends createZodDto(ragRetrieveSchema) {}
export class RagQueryDto extends createZodDto(ragQuerySchema) {}
export class RagIndexDto extends createZodDto(ragIndexSchema) {}
