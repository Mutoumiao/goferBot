import { IsOptional, IsString, IsBoolean, Validate } from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { PagerDto } from '../../../shared/dto/pager.dto.js'

function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    return value === 'true' || value === '1'
  }
  if (typeof value === 'number') {
    return value === 1
  }
  return undefined
}

export class AdminUserListQueryDto extends PagerDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isActive?: boolean
}
