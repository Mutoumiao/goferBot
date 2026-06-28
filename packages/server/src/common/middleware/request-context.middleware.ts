import { Injectable, NestMiddleware } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { RequestContextStorage } from '../request-context-storage.js'
import { extractRequestContext } from '../utils/request-context.js'

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: FastifyRequest, _res: FastifyReply, next: () => void) {
    const context = extractRequestContext(req)
    RequestContextStorage.run(context, next)
  }
}
