import { z } from 'zod'
import { AppException } from './lib/app-error.js'

const optionalNonEmptyString = z.preprocess(
  (val) => (val === '' ? undefined : val),
  z.string().optional(),
)

const envSchema = z.object({
  // === 基础 ===
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default('api'),

  // === 数据库 ===
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 不能为空'),

  // === 缓存/队列 ===
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: optionalNonEmptyString,

  // === 认证 ===
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
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(31).default(12),

  // === 存储（MinIO/S3） ===
  MINIO_ENDPOINT: optionalNonEmptyString,
  MINIO_PORT: z.coerce.number().int().positive().optional(),
  MINIO_ACCESS_KEY: optionalNonEmptyString,
  MINIO_SECRET_KEY: optionalNonEmptyString,
  MINIO_BUCKET: optionalNonEmptyString,

  // === 安全 ===
  SSRF_ALLOWED_HOSTNAMES: optionalNonEmptyString,
  CORS_ORIGIN: optionalNonEmptyString,
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
