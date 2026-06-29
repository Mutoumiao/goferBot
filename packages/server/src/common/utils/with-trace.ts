import { getRequestContext } from '../request-context-storage.js'

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    try {
      return JSON.stringify(String(value))
    } catch {
      return '"[unserializable]"'
    }
  }
}

function formatValue(v: unknown): string {
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v)
  }
  return safeStringify(v)
}

export function withTrace(message: string, meta?: Record<string, unknown>): string {
  const ctx = getRequestContext()
  const traceId = ctx?.traceId ?? 'no-trace'
  const requestId = ctx?.requestId ?? 'no-request-id'
  const prefix = `[trace:${traceId}] [req:${requestId}]`
  if (!meta) return `${prefix} ${message}`
  let metaStr = ''
  try {
    metaStr = Object.entries(meta)
      .map(([k, v]) => `${k}=${formatValue(v)}`)
      .join(' ')
  } catch {
    metaStr = '[unserializable-meta]'
  }
  return `${prefix} ${message} ${metaStr}`
}
