import { z } from 'zod'
import { AppException } from './lib/app-error.js'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number()).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 不能为空'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET 至少 16 字符'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET 至少 16 字符'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, 'JWT_EXPIRES_IN 格式无效，预期如 15m、2h、7d')
    .default('2h'),
  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, 'JWT_REFRESH_EXPIRES_IN 格式无效，预期如 15m、2h、7d')
    .default('7d'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).pipe(z.number()).default(6379),
  BCRYPT_SALT_ROUNDS: z.string().transform(Number).pipe(z.number()).default(12),
  SSRF_ALLOWED_HOSTNAMES: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env)
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      throw new AppException('CONFIG_VALIDATION_ERROR', `启动配置校验失败: ${issues}`, 500)
    }
    throw err
  }
}
