import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { BYPASS_RESPONSE_KEY } from '../decorators/bypass-response.decorator.js'

export interface ApiResponse<T> {
  data: T
}

/**
 * 递归将值中的 bigint 转换为 number，避免 JSON 序列化报
 * "Do not know how to serialize a BigInt"。
 * 全站响应统一在此兜底，无需各 service 逐个转换 Prisma 的 BigInt 字段（如 Document.size）。
 */
function serializeBigInt(value: unknown): unknown {
  if (typeof value === 'bigint') {
    // ponytail: 使用字符串保留精度；超过 MAX_SAFE_INTEGER 时 Number() 会丢失精度
    return value.toString()
  }
  if (Array.isArray(value)) {
    return value.map(serializeBigInt)
  }
  if (value !== null && typeof value === 'object') {
    // 仅处理普通对象，保留 Date 等内建类型原样（由序列化层自行处理）
    if (Object.getPrototypeOf(value) === Object.prototype) {
      const out: Record<string, unknown> = {} 
      for (const [key, val] of Object.entries(value)) {
        out[key] = serializeBigInt(val)
      }
      return out
    }
  }
  return value
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

        return { data: serializeBigInt(data) } as ApiResponse<T>
      }),
    )
  }
}
