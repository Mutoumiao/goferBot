import { Injectable, Scope } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'

export interface SseFrame {
  event?: string
  data: unknown
}

export interface SseErrorFrame {
  event: 'error'
  data: {
    conversation_id?: string
    message_id?: string
    error: string
  }
}

@Injectable({ scope: Scope.REQUEST })
export class SseResponseHelper {
  private reply: FastifyReply | null = null
  private onCloseCallbacks: Array<() => void> = []

  /**
   * 初始化 SSE 响应：设置 header、监听客户端断开。
   * 返回 AbortController，供上游在客户端断开时取消长时间任务。
   */
  init(_req: FastifyRequest, reply: FastifyReply): AbortController {
    this.reply = reply
    const abortController = new AbortController()

    const onClose = () => {
      abortController.abort()
      this.runCloseCallbacks()
    }

    reply.raw.on('close', onClose)
    this.onCloseCallbacks.push(() => {
      reply.raw.removeListener('close', onClose)
    })

    reply.raw.statusCode = 200
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')

    // 透传 Fastify CORS 插件已计算好的跨域头（含 vary: Origin），
    // 避免直接写 raw 时丢失，导致浏览器报 CORS 错误。
    const replyHeaders = reply.getHeaders()
    for (const [key, value] of Object.entries(replyHeaders)) {
      const lower = key.toLowerCase()
      if (value !== undefined && (lower.startsWith('access-control-') || lower === 'vary')) {
        reply.raw.setHeader(key, value)
      }
    }

    return abortController
  }

  /**
   * 写入一帧 SSE 数据。
   */
  write(frame: SseFrame | SseErrorFrame): boolean {
    if (!this.reply || this.reply.raw.destroyed) {
      return false
    }

    const eventLine = frame.event ? `event: ${frame.event}\n` : ''
    const dataLine = `data: ${JSON.stringify(frame.data)}\n\n`
    return this.reply.raw.write(eventLine + dataLine)
  }

  /**
   * 发送 error 事件并结束响应。
   */
  writeError(error: string, context?: { conversationId?: string; messageId?: string }): void {
    this.write({
      event: 'error',
      data: {
        conversation_id: context?.conversationId,
        message_id: context?.messageId,
        error,
      },
    })
    this.end()
  }

  /**
   * 结束 SSE 响应。
   */
  end(): void {
    if (this.reply && !this.reply.raw.destroyed) {
      this.reply.raw.end()
    }
    this.runCloseCallbacks()
  }

  /**
   * 注册在连接关闭或响应结束时执行的清理回调。
   */
  onClose(callback: () => void): void {
    this.onCloseCallbacks.push(callback)
  }

  private runCloseCallbacks(): void {
    for (const cb of this.onCloseCallbacks) {
      try {
        cb()
      } catch {
        // 忽略清理回调中的错误
      }
    }
    this.onCloseCallbacks = []
  }
}
