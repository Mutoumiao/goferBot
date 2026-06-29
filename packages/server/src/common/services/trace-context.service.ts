import { Injectable } from '@nestjs/common'
import { getRequestContext } from '../request-context-storage.js'

@Injectable()
export class TraceContextService {
  current(): string {
    return getRequestContext()?.traceId ?? 'no-trace'
  }

  currentRequestId(): string {
    return getRequestContext()?.requestId ?? 'no-request-id'
  }

  currentEmail(): string | undefined {
    return getRequestContext()?.email
  }
}
