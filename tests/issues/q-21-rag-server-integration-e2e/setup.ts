import { Test } from '@nestjs/testing'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from '../../../packages/server/src/app.module.js'
import { PrismaService } from '../../../packages/server/src/processors/database/prisma.service.js'
import { createServer } from 'http'

export let app: NestFastifyApplication
export let prisma: PrismaService
export let mockEmbeddingPort: number
export let mockLLMPort: number

export async function setupE2E(): Promise<void> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()

  app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter())
  await app.init()
  await app.getHttpAdapter().getInstance().ready()

  prisma = app.get(PrismaService)

  mockEmbeddingPort = await startMockEmbeddingServer()
  mockLLMPort = await startMockLLMServer()
}

export async function teardownE2E(): Promise<void> {
  await app.close()
}

async function startMockEmbeddingServer(): Promise<number> {
  const dim = parseInt(process.env.MILVUS_VECTOR_DIM || '1536', 10)
  const server = createServer((req, res) => {
    if (req.url === '/v1/embeddings' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        object: 'list',
        data: [{ object: 'embedding', embedding: Array(dim).fill(0.1), index: 0 }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 20, total_tokens: 20 },
      }))
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve((server.address() as any).port)
    })
  })
}

async function startMockLLMServer(): Promise<number> {
  const server = createServer((req, res) => {
    if (req.url?.includes('/chat/completions') && req.method === 'POST') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      const chunks = ['GoferBot', ' RAG', ' integration', ' test', ' content', '.']
      chunks.forEach((text) => {
        res.write(`data: {"choices":[{"delta":{"content":"${text}"}}]}\n\n`)
      })
      res.write('data: [DONE]\n\n')
      res.end()
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve((server.address() as any).port)
    })
  })
}
