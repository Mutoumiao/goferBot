import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { FastifyReply, FastifyRequest } from 'fastify'

export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()

    if (request.method === 'OPTIONS') {
      response.status(HttpStatus.OK).send()
      return
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR

    const isDevelopment = process.env.NODE_ENV === 'development'

    let code = 'INTERNAL_ERROR'
    let message = '服务器内部错误'
    let details: unknown | undefined

    if (exception instanceof HttpException) {
      const res = exception.getResponse()
      if (typeof res === 'string') {
        message = res
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, unknown>
        code = (obj.code as string) || this.mapStatusToCode(status)
        message = (obj.message as string) || message
        details = obj.details
      }
    } else if (exception instanceof Error) {
      message = exception.message
    }

    const errorResponse: ErrorResponse = {
      error: {
        code,
        message,
      },
    }

    if (details) {
      errorResponse.error.details = details
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} ${exception instanceof Error ? exception.stack : String(exception)}`,
      )
    } else {
      this.logger.warn(
        `${request.method} ${request.url} ${status} ${message}`,
      )
    }

    response.status(status).type('application/json').send(errorResponse)
  }

  private mapStatusToCode(status: number): string {
    const map: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
      [HttpStatus.UNAUTHORIZED]: 'AUTH_ERROR',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
      [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMIT_EXCEEDED',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
    }
    return map[status] || 'UNKNOWN_ERROR'
  }
}
