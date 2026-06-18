import { Controller, Get, Inject, Req, Res } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bootstrap } from '../../../src/bootstrap.js'
import { BypassResponse } from '../../../src/common/decorators/bypass-response.decorator.js'
import { SseResponseHelper } from '../../../src/common/helpers/sse-response.helper.js'

@Controller('cors-sse-test')
class CorsSseTestController {
  constructor(
    @Inject(SseResponseHelper)
    private readonly sse: SseResponseHelper,
  ) {}

  @Get()
  @BypassResponse()
  run(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    this.sse.init(req, reply)
    this.sse.write({ data: { ok: true } })
    this.sse.end()
  }
}

describe('SSE raw response CORS headers', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env', '../.env'],
        }),
      ],
      controllers: [CorsSseTestController],
      providers: [SseResponseHelper],
    }).compile()

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ bodyLimit: 1048576 }),
    )

    await bootstrap(app)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('应在直接写入 raw 的 SSE 响应中保留跨域头', async () => {
    const origin = 'http://localhost:1420'
    const res = await app.inject({
      method: 'GET',
      url: '/api/cors-sse-test',
      headers: { origin },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
    expect(res.headers['access-control-allow-origin']).toBe(origin)
    expect(res.headers['access-control-allow-credentials']).toBe('true')
    expect(res.headers['vary']).toContain('Origin')
  })

  it('当 origin 不在白名单时，应拒绝请求且不附加跨域头', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/cors-sse-test',
      headers: { origin: 'http://evil.example.com' },
    })

    expect(res.statusCode).toBeGreaterThanOrEqual(400)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })
})
