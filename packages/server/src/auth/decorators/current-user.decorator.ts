import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest()
  const user = request.user as Express.User | undefined
  const key = data as keyof Express.User | undefined

  return key ? user?.[key] : user
})
