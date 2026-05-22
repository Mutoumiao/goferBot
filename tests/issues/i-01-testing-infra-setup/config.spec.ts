import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

describe('Test configuration', () => {
  it('AC-06: vitest.integration.config.ts exists with correct setup', () => {
    const content = readFileSync('vitest.integration.config.ts', 'utf-8')
    expect(content).toContain("include: ['tests/integration/**/*.spec.ts'")
    expect(content).toContain('unplugin-swc')
    expect(content).toContain('setupFiles')
    expect(content).toContain('decoratorMetadata')
  })

  it('AC-07: vitest.e2e-api.config.ts exists', () => {
    expect(existsSync('vitest.e2e-api.config.ts')).toBe(true)
  })

  it('AC-09: .env.test exists with required variables', () => {
    const content = readFileSync('.env.test', 'utf-8')
    expect(content).toContain('DATABASE_URL=')
    expect(content).toContain('TEST_DATABASE_ADMIN_URL=')
    expect(content).toContain('MINIO_BUCKET=')
    expect(content).toContain('MILVUS_COLLECTION=')
    expect(content).toContain('REDIS_DB=')
    expect(content).toContain('JWT_SECRET=')
    expect(content).toContain('JWT_REFRESH_SECRET=')
    expect(content).toContain('SETTINGS_ENCRYPTION_KEY=')
  })

  it('AC-08: package.json has test scripts', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
    expect(pkg.scripts['test:integration']).toBeDefined()
    expect(pkg.scripts['test:integration:watch']).toBeDefined()
  })
})
