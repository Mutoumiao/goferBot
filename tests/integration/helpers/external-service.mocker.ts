import nock from 'nock'

export const ExternalServiceMocker = {
  mockLLMStream(content: string): void {
    nock('https://api.openai.com')
      .post('/v1/chat/completions')
      .reply(200, () => {
        const sse = [
          'data: {"choices":[{"delta":{"role":"assistant"}}]}',
          `data: {"choices":[{"delta":{"content":"${content}"}}]}`,
          'data: [DONE]',
        ].join('\n\n')
        return sse
      }, { 'Content-Type': 'text/event-stream' })
  },

  mockEmbedding(vector: number[]): void {
    nock('https://api.openai.com')
      .post('/v1/embeddings')
      .reply(200, {
        data: [{ embedding: vector }],
      })
  },

  cleanAll(): void {
    nock.cleanAll()
  },
}
