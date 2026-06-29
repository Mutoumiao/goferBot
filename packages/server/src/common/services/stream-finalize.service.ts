import { Injectable, Logger } from '@nestjs/common'
import { RequestContextStorage } from '../request-context-storage.js'
import { withTrace } from '../../common/utils/with-trace.js'

export interface FinalizeStep {
  name: string
  run: () => Promise<unknown>
}

export interface FinalizeContext {
  userId?: string
  sessionId?: string
  span?: string
}

@Injectable()
export class StreamFinalizeService {
  private readonly logger = new Logger(StreamFinalizeService.name)

  schedule(
    context: FinalizeContext,
    steps: FinalizeStep[],
  ): void {
    const captured = RequestContextStorage.get()
    const label = context.span ?? 'stream.finalize'

    const work = () => {
      const wrapped = captured
        ? (fn: () => void) => RequestContextStorage.run(captured, fn)
        : (fn: () => void) => fn()

      wrapped(() => {
        for (const step of steps) {
          try {
            step.run().catch((err) => {
              this.logger.error(
                withTrace(`[${label}] background step failed`, {
                  span: label,
                  userId: context.userId,
                  sessionId: context.sessionId,
                  step: step.name,
                  error: err instanceof Error ? err.message : String(err),
                }),
              )
            })
          } catch (err) {
            this.logger.error(
              withTrace(`[${label}] background step failed`, {
                span: label,
                userId: context.userId,
                sessionId: context.sessionId,
                step: step.name,
                error: err instanceof Error ? err.message : String(err),
              }),
            )
          }
        }
      })
    }

    if (typeof queueMicrotask === 'function') {
      queueMicrotask(work)
    } else {
      setImmediate(work)
    }
  }
}
