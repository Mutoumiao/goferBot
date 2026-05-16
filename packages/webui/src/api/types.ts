export interface RequestConfig {
  path: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
}

export interface SSEConfig {
  headers?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
}

export interface SSECallbacks<T = unknown> {
  onChunk: (chunk: T) => void
  onError: (error: import('./errors').ApiError | import('./errors').NetworkError) => void
  onDone: () => void
}

export type RequestInterceptor = (
  config: RequestConfig
) => RequestConfig | Promise<RequestConfig>

export type ResponseInterceptor = (
  response: Response,
  config: RequestConfig
) => Response | Promise<Response>

export interface CreateApiClientOptions {
  baseURL?: string
  defaultHeaders?: Record<string, string>
  defaultTimeout?: number
}

// DTO 类型（与后端手动同步）
export interface SignInRequest {
  email: string
  password: string
}

export interface SignUpRequest {
  email: string
  password: string
  name?: string
}

export interface AuthSession {
  id: string
  email: string
  name: string | null
}

export interface ChatRequest {
  message: string
  sessionId: string
  knowledgeBaseIds?: string[]
  config: {
    provider: string
    model: string
    baseUrl: string
    apiKey: string
  }
}

export interface ChatChunk {
  chunk: string
  done: boolean
}

export interface KnowledgeBaseDTO {
  id: string
  name: string
  path: string
  created_at: number
  deleted_at: number | null
  is_pinned: number
  sort_order: number
  icon: string
}

export interface FileItemDTO {
  name: string
  type: 'file' | 'directory'
  size?: number
  updatedAt: number
}
