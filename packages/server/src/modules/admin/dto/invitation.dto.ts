import { createInvitationRequestSchema, invitationListQuerySchema } from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class CreateInvitationDto extends createZodDto(createInvitationRequestSchema) {}
export class InvitationListQueryDto extends createZodDto(invitationListQuerySchema) {}
