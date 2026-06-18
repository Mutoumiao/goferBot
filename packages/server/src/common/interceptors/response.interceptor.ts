import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { BYPASS_RESPONSE_KEY } from '../decorators/bypass-response.decorator.js'

export interface ApiResponse<T> {
  data: T
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const handler = context.getHandler()
    const bypass = this.reflector.get<boolean>(BYPASS_RESPONSE_KEY, handler)

    if (bypass) {
      return next.handle() as Observable<ApiResponse<T>>
    }

    return next.handle().pipe(
      map((data) => {
        if (typeof data === 'undefined') {
          return { data: null } as ApiResponse<T>
        }

        return { data } as ApiResponse<T>
      }),
    )
  }
}
