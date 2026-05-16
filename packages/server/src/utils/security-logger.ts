export type SecurityEvent =
  | 'auth_failure'
  | 'auth_success'
  | 'rate_limit'
  | 'invalid_input'
  | 'ssrf_blocked'

interface SecurityLogPayload {
  event: SecurityEvent
  ip: string
  userId?: string
  path?: string
  metadata?: Record<string, unknown>
}

function getClientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')
    ?? headers.get('x-real-ip')
    ?? 'unknown'
}

function redactSensitive(value: unknown): unknown {
  if (typeof value !== 'string') return value
  // API Key：保留前 4 位 + ... + 后 4 位
  if (value.length > 12 && (value.startsWith('sk-') || value.startsWith('ak-'))) {
    return `${value.slice(0, 4)}...${value.slice(-4)}`
  }
  // 密码
  if (value.length >= 6) {
    return '[REDACTED]'
  }
  return value
}

export function logSecurityEvent(payload: SecurityLogPayload): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...payload,
    metadata: payload.metadata
      ? Object.fromEntries(
          Object.entries(payload.metadata).map(([k, v]) => [
            k,
            k.includes('password') || k.includes('apiKey') || k.includes('token')
              ? redactSensitive(v)
              : v,
          ]),
        )
      : undefined,
  }

  if (payload.event === 'auth_success') {
    console.info('[Security]', JSON.stringify(logEntry))
  } else {
    console.warn('[Security]', JSON.stringify(logEntry))
  }
}

export function logAuthFailure(ip: string, reason: string, email?: string): void {
  logSecurityEvent({
    event: 'auth_failure',
    ip,
    metadata: { reason, emailHash: email ? hashEmail(email) : undefined },
  })
}

export function logRateLimit(ip: string, path: string, limit: number, windowMs: number): void {
  logSecurityEvent({
    event: 'rate_limit',
    ip,
    path,
    metadata: { limit, window: `${windowMs}ms` },
  })
}

export function logInvalidInput(ip: string, path: string, issues: Array<{ field: string; issue: string }>): void {
  logSecurityEvent({
    event: 'invalid_input',
    ip,
    path,
    metadata: { issues },
  })
}

export function logSsrfBlocked(ip: string, baseUrl: string, userId?: string): void {
  logSecurityEvent({
    event: 'ssrf_blocked',
    ip,
    userId,
    metadata: { baseUrl },
  })
}

function hashEmail(email: string): string {
  // 简单哈希：避免日志中存储明文邮箱
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return `email_hash_${Math.abs(hash)}`
}
