import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'

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
    const now = Date.now()

    this.logger.debug(
      `+++ Request: ${method} ${url} (ip: ${request.ip ?? request.socket?.remoteAddress ?? 'unknown'})`,
    )

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse()
        const statusCode = response.statusCode || 200
        const duration = Date.now() - now
        this.logger.debug(`--- Response: ${method} ${url} ${statusCode} +${duration}ms`)
      }),
    )
  }
}
