# API 规格：RAG SDK 可观测性模块

## 类型定义

### RAGStage

```typescript
interface RAGStage {
  name: string
  startTime: number
  endTime?: number
  input?: unknown
  output?: unknown
  error?: string
}
```

### RAGTrace

```typescript
interface RAGTrace {
  traceId: string
  name: string
  startTime: number
  endTime?: number
  stages: RAGStage[]
  error?: string
  metadata?: Record<string, unknown>
}
```

### RAGObserver

```typescript
interface RAGObserver {
  onTraceStart?(trace: RAGTrace): void
  onTraceStage?(trace: RAGTrace, stage: RAGStage): void
  onTraceComplete?(trace: RAGTrace): void
  onTraceError?(trace: RAGTrace, error: Error): void
}
```

---

## RAGTracer

```typescript
class RAGTracer {
  constructor(observers?: RAGObserver[])

  start(name: string, metadata?: Record<string, unknown>): RAGTrace
  stage(trace: RAGTrace, name: string, input?: unknown): RAGStage
  completeStage(stage: RAGStage, output?: unknown): void
  complete(trace: RAGTrace): void
  error(trace: RAGTrace, error: Error): void
}
```

#### 生命周期

1. **start**: 创建新 RAGTrace，分配 traceId（uuid），记录 startTime
2. **stage**: 在 trace 上添加新 RAGStage，记录 startTime，通知 observers
3. **completeStage**: 设置 stage.endTime 和 output，通知 observers
4. **complete**: 设置 trace.endTime，通知 observers
5. **error**: 设置 trace.error 和当前 stage.error，通知 observers

---

## consoleObserver

```typescript
const consoleObserver: RAGObserver
```

默认实现，输出结构化日志到 console：
- `onTraceStart`: `console.log('[RAG] trace start', { traceId, name })`
- `onTraceStage`: `console.log('[RAG] stage', { traceId, stageName, duration })`
- `onTraceComplete`: `console.log('[RAG] trace complete', { traceId, totalDuration })`
- `onTraceError`: `console.error('[RAG] trace error', { traceId, error })`

---

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| Tracer start | `tests/issues/d-14-rag-sdk-observability/observability.spec.ts` | `AC-02: creates trace with traceId and startTime` |
| Tracer stage | `tests/issues/d-14-rag-sdk-observability/observability.spec.ts` | `AC-02: adds stage to trace` |
| Tracer complete | `tests/issues/d-14-rag-sdk-observability/observability.spec.ts` | `AC-02: completes trace with endTime` |
| Tracer error | `tests/issues/d-14-rag-sdk-observability/observability.spec.ts` | `AC-02: records error in trace and stage` |
| consoleObserver | `tests/issues/d-14-rag-sdk-observability/observability.spec.ts` | `AC-03: logs structured messages to console` |
| 多 observer | `tests/issues/d-14-rag-sdk-observability/observability.spec.ts` | `AC-03: notifies all observers` |
