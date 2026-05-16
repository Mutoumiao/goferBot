import { cors } from 'hono/cors'
import type { Hono } from 'hono'

const ALLOWED_ORIGINS = [
  'http://localhost:1420',
  'http://localhost:5173',
  'tauri://localhost',
]

function getOrigin(origin: string | undefined): string | null {
  if (!origin) return null
  if (ALLOWED_ORIGINS.includes(origin)) return origin
  // 开发环境允许 localhost 任意端口
  if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin)) {
    return origin
  }
  return null
}

export function applyCors(app: Hono): void {
  app.use('*', cors({
    origin: (origin) => getOrigin(origin) ?? '',
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type', 'Cookie'],
    credentials: true,
  }))
}
