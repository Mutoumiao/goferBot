import { createServer, Server } from 'http'

export function startMockLLMServer(port: number): Server {
  return createServer((req, res) => {
    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })

      const chunks = [
        { choices: [{ delta: { content: 'RAG works' }, index: 0 }] },
        { choices: [{ delta: { content: '!' }, index: 0 }] },
      ]

      for (const chunk of chunks) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`)
      }
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }
    res.writeHead(404)
    res.end('Not found')
  }).listen(port)
}
