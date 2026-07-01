import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { AuthApp } from '../types/auth-app.type.js'

export interface AuthUser {
  id: string
  email: string
  name?: string
  avatar?: string | null
  roles: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  sessionId: string
  app: AuthApp
}

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest()
  const user = request.user as AuthUser | undefined
  const key = data as keyof AuthUser | undefined

  return key ? user?.[key] : user
})
