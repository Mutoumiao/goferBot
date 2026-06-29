import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { getRequestContext } from '../request-context-storage.js'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name)

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isProduction = process.env.NODE_ENV === 'production'
    if (isProduction) {
      return next.handle()
    }

    const request = context.switchToHttp().getRequest()
    const method = request.method
    const url = request.url
    const ctx = getRequestContext()
    const requestId = ctx?.requestId || 'unknown'
    const traceId = ctx?.traceId || requestId
    const ip = ctx?.ip || 'unknown'
    const now = Date.now()

    this.logger.debug(`[trace:${traceId}] [req:${requestId}] +++ Request: ${method} ${url} (ip: ${ip})`)

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse()
        const statusCode = response.statusCode || 200
        const duration = Date.now() - now
        this.logger.debug(
          `[trace:${traceId}] [req:${requestId}] --- Response: ${method} ${url} ${statusCode} +${duration}ms`,
        )
      }),
    )
  }
}
