import { createZodValidationPipe } from 'nestjs-zod'
import { ZodError } from 'zod/v4'
import { BadRequestException } from '@nestjs/common'

export const ZodValidationPipe = createZodValidationPipe({
  createValidationException: (error) => {
    const details =
      error instanceof ZodError
        ? error.issues.map((issue) => ({
            field: issue.path?.join('.') ?? '',
            issue: issue.message,
          }))
        : undefined

    return new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: '请求参数校验失败',
      details,
    })
  },
})
