import {
  assignRoleRequestSchema,
  createAdminUserRequestSchema,
  resetPasswordRequestSchema,
} from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class CreateAdminUserDto extends createZodDto(createAdminUserRequestSchema) {}
export class AssignRoleDto extends createZodDto(assignRoleRequestSchema) {}
export class ResetPasswordDto extends createZodDto(resetPasswordRequestSchema) {}
