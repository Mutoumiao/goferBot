import { Injectable, NestMiddleware } from '@nestjs/common'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'

declare module 'fastify' {
  interface FastifyRequest {
    requestId?: string
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    req.requestId = (req.headers['x-request-id'] as string) || randomUUID()
    res.header('X-Request-Id', req.requestId)
    next()
  }
}
