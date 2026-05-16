export abstract class ApiClientError extends Error {
  abstract readonly type: 'api' | 'network'
}

export interface ApiErrorPayload {
  status: number
  code: string
  message: string
  raw?: unknown
}

export class ApiError extends ApiClientError {
  readonly type = 'api' as const
  readonly status: number
  readonly code: string
  readonly raw?: unknown

  constructor(payload: ApiErrorPayload) {
    super(payload.message)
    this.status = payload.status
    this.code = payload.code
    this.raw = payload.raw
  }
}

export class NetworkError extends ApiClientError {
  readonly type = 'network' as const
  readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.cause = cause
  }
}
