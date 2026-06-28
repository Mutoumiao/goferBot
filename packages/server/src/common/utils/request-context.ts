import type { FastifyRequest } from 'fastify'

export interface RequestContext {
  ip: string
  userAgent: string
  email?: string
  requestId: string
}

export function extractRequestContext(req: FastifyRequest): RequestContext {
  const forwardedFor = req.headers['x-forwarded-for']
  const firstForwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
  const ip = (firstForwarded?.split(',')[0]?.trim() ?? req.ip ?? 'unknown') as string

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
