import { createZodValidationPipe } from 'nestjs-zod'
import { ZodError } from 'zod'
import { UnprocessableEntityException } from '@nestjs/common'

export const ZodValidationPipe = createZodValidationPipe({
  createValidationException: (error: ZodError) => {
    const details = error.errors.map((e) => ({
      field: e.path.join('.'),
      issue: e.message,
    }))

    return new UnprocessableEntityException({
      code: 'VALIDATION_ERROR',
      message: '请求参数校验失败',
      details,
    })
  },
})
