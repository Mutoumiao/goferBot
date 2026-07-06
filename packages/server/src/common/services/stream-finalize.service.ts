import { randomUUID } from 'node:crypto'
import { Injectable, Logger, Optional } from '@nestjs/common'
import { QueueService } from '../../processors/queue/queue.service.js'
import { RequestContextStorage } from '../request-context-storage.js'
import { withTrace } from '../utils/with-trace.js'

interface FinalizeStep {
  name: string
  run: () => Promise<unknown>
}

interface FinalizeContext {
  userId?: string
  sessionId?: string
  span?: string
  messageId?: string
  input?: string
  fullReply?: string
}

@Injectable()
export class StreamFinalizeService {
  private readonly logger = new Logger(StreamFinalizeService.name)

  constructor(@Optional() private readonly queueService?: QueueService) {}

  private async isDurable(): Promise<boolean> {
    return (await this.queueService?.isHealthy()) ?? false
  }

  async schedule(context: FinalizeContext, steps: FinalizeStep[]): Promise<void> {
    const captured = RequestContextStorage.get()
    const label = context.span ?? 'stream.finalize'
    if (await this.tryEnqueue(context, captured, label)) return
    this.runStepsAsMicrotask(context, captured, label, steps)
  }

  private async tryEnqueue(
    context: FinalizeContext,
    captured: ReturnType<typeof RequestContextStorage.get>,
    label: string,
  ): Promise<boolean> {
    const durable = await this.isDurable()
    if (!durable || !this.queueService) return false
    try {
      await this.queueService.addChatFinalizeJob({
        sessionId: context.sessionId ?? 'unknown',
        messageId: context.messageId ?? randomUUID(),
        userId: context.userId,
        fullReply: context.fullReply ?? '',
        input: context.input ?? '',
        traceId: captured?.traceId ?? 'unknown',
        requestId: captured?.requestId ?? 'unknown',
      })
      this.logger.debug(
        withTrace(`[${label}] job enqueued to BullMQ`, {
          span: label,
          sessionId: context.sessionId,
        }),
      )
      return true
    } catch (err) {
      this.logger.warn(
        withTrace(`[${label}] BullMQ enqueue failed, fallback to microtask`, {
          span: label,
          sessionId: context.sessionId,
          error: err instanceof Error ? err.message : String(err),
        }),
      )
      return false
    }
  }

  private runStepsAsMicrotask(
    context: FinalizeContext,
    captured: ReturnType<typeof RequestContextStorage.get>,
    label: string,
    steps: FinalizeStep[],
  ): void {
    const work = () => {
      const wrapped = captured
        ? (fn: () => void) => RequestContextStorage.run(captured, fn)
        : (fn: () => void) => fn()

      wrapped(() => {
        for (const step of steps) {
          try {
            step.run().catch((err) => this.logStepError(label, context, step.name, err))
          } catch (err) {
            this.logStepError(label, context, step.name, err)
          }
        }
      })
    }
    queueMicrotask(work)
  }

  private logStepError(
    label: string,
    context: FinalizeContext,
    stepName: string,
    err: unknown,
  ): void {
    this.logger.error(
      withTrace(`[${label}] background step failed`, {
        span: label,
        userId: context.userId,
        sessionId: context.sessionId,
        step: stepName,
        error: err instanceof Error ? `${err.message}\n${err.stack}` : String(err),
      }),
    )
  }
}
