import { describe, it, expect, vi } from 'vitest'
import { RAGTracer } from '../../../packages/rag-sdk/src/observability/tracer.js'
import { consoleObserver } from '../../../packages/rag-sdk/src/observability/console-observer.js'
import type { RAGObserver } from '../../../packages/rag-sdk/src/observability/types.js'

describe('RAGTracer', () => {
  it('AC-02: creates trace with traceId and startTime', () => {
    const tracer = new RAGTracer()
    const trace = tracer.start('test-trace')
    expect(trace.traceId).toBeDefined()
    expect(trace.name).toBe('test-trace')
    expect(trace.startTime).toBeGreaterThan(0)
    expect(trace.stages).toEqual([])
  })

  it('AC-02: adds stage to trace', () => {
    const tracer = new RAGTracer()
    const trace = tracer.start('test')
    const stage = tracer.stage(trace, 'chunk')
    expect(stage.name).toBe('chunk')
    expect(stage.startTime).toBeGreaterThan(0)
    expect(trace.stages).toHaveLength(1)
  })

  it('AC-02: completes trace with endTime', () => {
    const tracer = new RAGTracer()
    const trace = tracer.start('test')
    tracer.complete(trace)
    expect(trace.endTime).toBeGreaterThanOrEqual(trace.startTime)
  })

  it('AC-02: records error in trace and stage', () => {
    const tracer = new RAGTracer()
    const trace = tracer.start('test')
    const stage = tracer.stage(trace, 'embed')
    const error = new Error('embed failed')
    tracer.error(trace, error)
    expect(trace.error).toBe('embed failed')
    expect(stage.error).toBe('embed failed')
  })

  it('AC-03: notifies all observers', () => {
    const onTraceStart = vi.fn()
    const onTraceComplete = vi.fn()
    const observer: RAGObserver = { onTraceStart, onTraceComplete }
    const tracer = new RAGTracer([observer])
    const trace = tracer.start('test')
    tracer.complete(trace)
    expect(onTraceStart).toHaveBeenCalledTimes(1)
    expect(onTraceComplete).toHaveBeenCalledTimes(1)
  })

  it('AC-03: consoleObserver logs structured messages', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const tracer = new RAGTracer([consoleObserver])
    const trace = tracer.start('test')
    const stage = tracer.stage(trace, 'embed')
    tracer.completeStage(stage)
    tracer.complete(trace)
    expect(logSpy).toHaveBeenCalled()
    logSpy.mockRestore()
    errorSpy.mockRestore()
  })
})

describe('observability exports', () => {
  it('AC-04: exports all observability modules', async () => {
    const mod = await import('../../../packages/rag-sdk/src/observability/index.js')
    expect(mod.RAGTracer).toBeDefined()
    expect(mod.consoleObserver).toBeDefined()
  })
})
