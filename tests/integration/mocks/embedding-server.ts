import { createServer, Server } from 'http'

export function startMockEmbeddingServer(port: number): Server {
  return createServer((req, res) => {
    if (req.url === '/v1/embeddings' && req.method === 'POST') {
      let body = ''
      req.on('data', (chunk) => {
        body += chunk
      })
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body)
          const inputs = Array.isArray(parsed.input) ? parsed.input : [parsed.input]
          const data = inputs.map((_: string, index: number) => ({
            embedding: Array(1536).fill(0.1),
            index,
          }))
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ data }))
        } catch {
          res.writeHead(400)
          res.end('Bad request')
        }
      })
      return
    }
    res.writeHead(404)
    res.end('Not found')
  }).listen(port)
}
