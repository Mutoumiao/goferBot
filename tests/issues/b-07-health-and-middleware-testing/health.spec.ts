// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { Test } from '@nestjs/testing'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { Reflector } from '@nestjs/core'
import { HealthModule } from '../../../packages/server/src/modules/health/health.module.js'
import { ResponseInterceptor } from '../../../packages/server/src/common/interceptors/response.interceptor.js'
import { AllExceptionsFilter } from '../../../packages/server/src/common/filters/all-exception.filter.js'

async function setupHealthApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [HealthModule],
  }).compile()

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  )
  app.useGlobalInterceptors(new ResponseInterceptor(new Reflector()))
  app.useGlobalFilters(new AllExceptionsFilter())
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  return app
}

describe('HealthController', () => {
  it('AC-01: returns health status with data wrapper', async () => {
    const app = await setupHealthApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toBeDefined()
    expect(body.data.status).toBe('ok')
    expect(body.data).toHaveProperty('timestamp')
    expect(body.data).toHaveProperty('version')
    await app.close()
  })

  it('AC-02: wraps response in data field', async () => {
    const app = await setupHealthApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    const body = res.json()
    expect(body).toHaveProperty('data')
    expect(body).not.toHaveProperty('status')
    await app.close()
  })
})
