import { createServer, Server } from 'http'

export function startMockEmbeddingServer(port: number): Server {
  return createServer((req, res) => {
    if (req.url === '/v1/embeddings' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        object: 'list',
        data: [
          { object: 'embedding', embedding: new Array(1536).fill(0.1), index: 0 },
        ],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 10, total_tokens: 10 },
      }))
      return
    }
    res.writeHead(404)
    res.end('Not found')
  }).listen(port)
}
