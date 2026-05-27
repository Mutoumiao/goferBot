export interface RAGStage {
  name: string
  startTime: number
  endTime?: number
  input?: unknown
  output?: unknown
  error?: string
}

export interface RAGTrace {
  traceId: string
  name: string
  startTime: number
  endTime?: number
  stages: RAGStage[]
  error?: string
  metadata?: Record<string, unknown>
}

export interface RAGObserver {
  onTraceStart?(trace: RAGTrace): void
  onTraceStage?(trace: RAGTrace, stage: RAGStage): void
  onTraceComplete?(trace: RAGTrace): void
  onTraceError?(trace: RAGTrace, error: Error): void
}
