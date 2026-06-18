import type { RAGObserver, RAGStage, RAGTrace } from './types.js'

export const consoleObserver: RAGObserver = {
  onTraceStart(trace: RAGTrace) {
    console.log('[RAG] trace start', { traceId: trace.traceId, name: trace.name })
  },

  onTraceStage(trace: RAGTrace, stage: RAGStage) {
    console.log('[RAG] stage', { traceId: trace.traceId, stageName: stage.name })
  },

  onTraceComplete(trace: RAGTrace) {
    const duration = (trace.endTime ?? trace.startTime) - trace.startTime
    console.log('[RAG] trace complete', { traceId: trace.traceId, totalDuration: duration })
  },

  onTraceError(trace: RAGTrace, error: Error) {
    console.error('[RAG] trace error', { traceId: trace.traceId, error: error.message })
  },
}
