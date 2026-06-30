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
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // === 数据库（Shared，单一来源：根目录 .env） ===
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 不能为空'),
  TEST_DATABASE_ADMIN_URL: optionalNonEmptyString,

  // === 缓存/队列（Shared，单一来源：根目录 .env） ===
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: optionalNonEmptyString,

  // === 认证 ===
  JWT_SECRET: z.string().min(16, 'JWT_SECRET 至少 16 字符'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET 至少 16 字符'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, 'JWT_EXPIRES_IN 格式无效，预期如 15m、2h、7d')
    .default('15m'),
  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, 'JWT_REFRESH_EXPIRES_IN 格式无效，预期如 15m、2h、7d')
    .default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(31).default(12),

  // === 配置加密 ===
  SETTINGS_ENCRYPTION_KEY: optionalNonEmptyString,

  // === 存储（MinIO/S3） ===
  MINIO_ENDPOINT: optionalNonEmptyString,
  MINIO_PORT: z.coerce.number().int().positive().optional(),
  MINIO_ACCESS_KEY: optionalNonEmptyString,
  MINIO_SECRET_KEY: optionalNonEmptyString,
  MINIO_BUCKET: optionalNonEmptyString,
  MINIO_REGION: optionalNonEmptyString,

  // === Elasticsearch ===
  ELASTICSEARCH_NODE: optionalNonEmptyString,
  ELASTICSEARCH_API_KEY: optionalNonEmptyString,
  ELASTICSEARCH_USERNAME: optionalNonEmptyString,
  ELASTICSEARCH_PASSWORD: optionalNonEmptyString,
  ELASTICSEARCH_INDEX: optionalNonEmptyString,

  // === 安全 ===
  SSRF_ALLOWED_HOSTNAMES: optionalNonEmptyString,
  CORS_ORIGIN: optionalNonEmptyString,

  // === 队列 ===
  QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(2),

  // === 元数据安全 ===
  METADATA_ALLOWED_KEYS: z
    .string()
    .default(
      'year,status,type,category,source,language,author,priority,department,project,tags,version',
    ),

  // === 实例级开关 ===
  RERANK_EAGER_LOAD: z
    .preprocess((val) => val === 'true' || val === '1' || val === true, z.boolean())
    .default(false),
})

export type Env = z.infer<typeof envSchema>

export function validateEnv(config?: Record<string, unknown>): Env {
  try {
    const source = config ?? process.env
    return envSchema.parse(source)
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      throw new AppException('CONFIG_VALIDATION_ERROR', `启动配置校验失败: ${issues}`, 500)
    }
    throw err
  }
}
