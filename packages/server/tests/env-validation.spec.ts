import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { validateEnv } from '../src/env.js'

describe('环境变量验证 (validateEnv)', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('应使用默认值填充缺失的基础配置', () => {
    process.env = {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
    }

    const result = validateEnv()

    expect(result.NODE_ENV).toBe('development')
    expect(result.PORT).toBe(3000)
    expect(result.LOG_LEVEL).toBe('info')
    expect(result.JWT_EXPIRES_IN).toBe('15m')
    expect(result.JWT_REFRESH_EXPIRES_IN).toBe('7d')
    expect(result.QUEUE_CONCURRENCY).toBe(2)
    expect(result.RERANK_EAGER_LOAD).toBe(false)
  })

  it('应接受有效的配置值', () => {
    process.env = {
      NODE_ENV: 'production',
      PORT: '8080',
      LOG_LEVEL: 'warn',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      JWT_EXPIRES_IN: '30m',
      JWT_REFRESH_EXPIRES_IN: '14d',
      BCRYPT_SALT_ROUNDS: '12',
      CORS_ORIGIN: 'https://example.com',
      REDIS_HOST: 'redis.local',
      REDIS_PORT: '6380',
      MINIO_ENDPOINT: 'http://minio:9000',
      MINIO_ACCESS_KEY: 'myaccesskey',
      MINIO_SECRET_KEY: 'mysecretkey',
      MINIO_BUCKET: 'mybucket',
      MINIO_REGION: 'eu-west-1',
      ELASTICSEARCH_NODE: 'http://es:9200',
      ELASTICSEARCH_INDEX: 'myindex',
      QUEUE_CONCURRENCY: '4',
      METADATA_ALLOWED_KEYS: 'year,status,custom_field',
      RERANK_EAGER_LOAD: 'true',
      // production 要求强服务令牌
      KNOWLEDGE_AI_SERVICE_TOKEN: 'prod-strong-token-at-least-16',
    }

    const result = validateEnv()

    expect(result.NODE_ENV).toBe('production')
    expect(result.PORT).toBe(8080)
    expect(result.LOG_LEVEL).toBe('warn')
    expect(result.JWT_EXPIRES_IN).toBe('30m')
    expect(result.JWT_REFRESH_EXPIRES_IN).toBe('14d')
    expect(result.BCRYPT_SALT_ROUNDS).toBe(12)
    expect(result.CORS_ORIGIN).toBe('https://example.com')
    expect(result.REDIS_HOST).toBe('redis.local')
    expect(result.REDIS_PORT).toBe(6380)
    expect(result.RERANK_EAGER_LOAD).toBe(true)
  })

  it('production 应拒绝弱默认 KNOWLEDGE_AI_SERVICE_TOKEN', () => {
    process.env = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      KNOWLEDGE_AI_SERVICE_TOKEN: 'dev-token-change-me',
    }

    let caughtError: any
    try {
      validateEnv()
      expect.fail('应该抛出异常')
    } catch (err: any) {
      caughtError = err
    }
    expect(caughtError?.code).toBe('CONFIG_VALIDATION_ERROR')
    expect(JSON.stringify(caughtError)).toContain('KNOWLEDGE_AI_SERVICE_TOKEN')
  })

  it('应拒绝格式错误的 JWT_EXPIRES_IN', () => {
    process.env = {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      JWT_EXPIRES_IN: 'invalid',
    }

    let caughtError: any
    try {
      validateEnv()
      expect.fail('应该抛出异常')
    } catch (err: any) {
      caughtError = err
    }

    // 验证异常被抛出
    expect(caughtError).toBeDefined()
    expect(caughtError).not.toBeNull()

    // 验证异常包含配置校验错误信息（AppException 格式）
    const errStr = JSON.stringify(caughtError)
    expect(errStr).toContain('JWT_EXPIRES_IN')
  })

  it('应接受 RERANK_EAGER_LOAD 为 true 或 false', () => {
    process.env = {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      RERANK_EAGER_LOAD: 'true',
    }

    expect(validateEnv().RERANK_EAGER_LOAD).toBe(true)
  })

  it('应设置 SSRF 白名单', () => {
    process.env = {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      SSRF_ALLOWED_HOSTNAMES: 'api.openai.com,api.deepseek.com',
    }

    expect(validateEnv().SSRF_ALLOWED_HOSTNAMES).toBe('api.openai.com,api.deepseek.com')
  })

  it('缺少 DATABASE_URL 时应抛出 AppException', () => {
    process.env = {
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
    }

    let caughtError: any
    try {
      validateEnv()
      expect.fail('应该抛出异常')
    } catch (err: any) {
      caughtError = err
    }

    expect(caughtError).toBeDefined()
    expect(caughtError.code).toBe('CONFIG_VALIDATION_ERROR')
    expect(caughtError.response.error.message).toContain('DATABASE_URL')
  })
})
