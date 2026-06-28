import type { FastifyRequest } from 'fastify'

export interface RequestContext {
  ip: string
  userAgent: string
  email?: string
  requestId: string
}

export function extractRequestContext(req: FastifyRequest): RequestContext {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown'

  const userAgent = (req.headers['user-agent'] as string) || 'unknown'
  const requestId = req.requestId || 'unknown'

  return {
    ip,
    userAgent,
    requestId,
  }
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}
