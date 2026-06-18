import type { RAGObserver, RAGStage, RAGTrace } from './types.js'

export class RAGTracer {
  constructor(private observers: RAGObserver[] = []) {}

  start(name: string, metadata?: Record<string, unknown>): RAGTrace {
    const trace: RAGTrace = {
      traceId: crypto.randomUUID(),
      name,
      startTime: Date.now(),
      stages: [],
      metadata,
    }
    this.notify('onTraceStart', trace)
    return trace
  }

  stage(trace: RAGTrace, name: string, input?: unknown): RAGStage {
    const stage: RAGStage = {
      name,
      startTime: Date.now(),
      input,
    }
    trace.stages.push(stage)
    this.notify('onTraceStage', trace, stage)
    return stage
  }

  completeStage(stage: RAGStage, output?: unknown): void {
    stage.endTime = Date.now()
    stage.output = output
  }

  complete(trace: RAGTrace): void {
    trace.endTime = Date.now()
    this.notify('onTraceComplete', trace)
  }

  error(trace: RAGTrace, error: Error): void {
    trace.error = error.message
    trace.endTime = Date.now()
    const currentStage = trace.stages.find((s) => s.endTime === undefined)
    if (currentStage) {
      currentStage.error = error.message
      currentStage.endTime = Date.now()
    }
    this.notify('onTraceError', trace, error)
  }

  private notify<K extends keyof RAGObserver>(
    event: K,
    ...args: Parameters<NonNullable<RAGObserver[K]>>
  ): void {
    for (const observer of this.observers) {
      const handler = observer[event] as (...args: unknown[]) => void
      if (handler) {
        handler(...args)
      }
    }
  }
}
