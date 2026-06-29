import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { getRequestContext } from '../request-context-storage.js'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name)

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isProduction = process.env.NODE_ENV === 'production'
    const slowThresholdMs =
      process.env.LOG_REQUEST_SLOW_THRESHOLD_MS !== undefined
        ? Number(process.env.LOG_REQUEST_SLOW_THRESHOLD_MS)
        : 2000
    const sampleRate =
      process.env.LOG_REQUEST_SAMPLE_RATE !== undefined
        ? Number(process.env.LOG_REQUEST_SAMPLE_RATE)
        : 0.1

    const request = context.switchToHttp().getRequest()
    const method = request.method
    const rawUrl = request.url
    const url = this.sanitizeUrl(rawUrl)
    const ctx = getRequestContext()
    const requestId = ctx?.requestId || 'unknown'
    const traceId = ctx?.traceId || requestId
    const ip = ctx?.ip || 'unknown'
    const now = Date.now()

    if (!isProduction) {
      this.logger.debug(
        `[trace:${traceId}] [req:${requestId}] +++ Request: ${method} ${url} (ip: ${ip})`,
      )
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse()
          const statusCode = response.statusCode || 200
          const duration = Date.now() - now
          const isSlow = duration > slowThresholdMs
          const isError = statusCode >= 400

          if (isProduction) {
            if (isError) {
              this.logger.error(
                `[trace:${traceId}] [req:${requestId}] ERROR: ${method} ${url} ${statusCode} +${duration}ms (ip: ${ip})`,
              )
            } else if (isSlow) {
              this.logger.log(
                `[trace:${traceId}] [req:${requestId}] SLOW: ${method} ${url} ${statusCode} +${duration}ms (ip: ${ip})`,
              )
            } else if (Math.random() < sampleRate) {
              this.logger.debug(
                `[trace:${traceId}] [req:${requestId}] --- Response: ${method} ${url} ${statusCode} +${duration}ms`,
              )
            }
          } else {
            this.logger.debug(
              `[trace:${traceId}] [req:${requestId}] --- Response: ${method} ${url} ${statusCode} +${duration}ms`,
            )
          }
        },
        error: (err) => {
          const duration = Date.now() - now
          this.logger.error(
            `[trace:${traceId}] [req:${requestId}] EXCEPTION: ${method} ${url} +${duration}ms (ip: ${ip}) - ${err.message}`,
          )
        },
      }),
    )
  }

  private sanitizeUrl(url: string): string {
    if (!url || url === '/') return url
    try {
      const [path, query] = url.split('?')
      if (!query) return url
      const sanitized = query
        .split('&')
        .map((pair) => {
          const [key, value] = pair.split('=')
          if (!key) return pair
          const lowerKey = key.toLowerCase()
          if (
            lowerKey === 'token' ||
            lowerKey === 'password' ||
            lowerKey === 'secret' ||
            lowerKey === 'apikey' ||
            lowerKey === 'api_key'
          ) {
            return `${key}=***`
          }
          return `${key}${value ? `=${value}` : ''}`
        })
        .join('&')
      return `${path}?${sanitized}`
    } catch {
      return url
    }
  }
}
