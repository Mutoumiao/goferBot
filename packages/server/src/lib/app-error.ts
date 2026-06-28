import { HttpException } from '@nestjs/common'

export class AppException extends HttpException {
  readonly code: string
  readonly details?: Record<string, unknown>

  constructor(
    code: string,
    message: string,
    status: number = 500,
    details?: Record<string, unknown>,
  ) {
    super(
      {
        success: false,
        error: {
          code,
          message,
          details,
        },
      },
      status,
    )
    this.code = code
    this.details = details
  }
}
