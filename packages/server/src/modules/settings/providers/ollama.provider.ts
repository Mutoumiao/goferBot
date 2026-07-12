import { ChatOllama } from '@langchain/ollama'
import { BaseProvider, type FetchedModel } from './base.provider.js'

export class OllamaProvider extends BaseProvider {
  async fetchModels(): Promise<FetchedModel[]> {
    const url = `${this.resolveBaseURL()}/api/tags`
    const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!resp.ok) throw new Error(`Ollama 返回 ${resp.status}`)

    // 限制响应体大小，防止恶意远程服务器返回超大 JSON 导致 OOM
    const MAX_RESPONSE_SIZE = 1_000_000 // 1MB
    const contentLength = Number.parseInt(resp.headers.get('content-length') ?? '0', 10)
    if (contentLength > MAX_RESPONSE_SIZE) {
      throw new Error('远程响应体过大（>1MB），已拒绝')
    }
    const text = await resp.text()
    if (text.length > MAX_RESPONSE_SIZE) {
      throw new Error('远程响应体过大（>1MB），已拒绝')
    }
    const json = JSON.parse(text) as {
      models?: Array<{ name: string; details?: { family?: string } }>
    }
    return (json.models ?? []).map((m) => ({
      name: m.name,
      type: m.details?.family?.includes('bert') ? 'embedding' : 'llm',
    }))
  }

  toLangChain(overrides?: Record<string, unknown>): ChatOllama {
    return new ChatOllama({
      model: this.model,
      baseUrl: this.resolveOllamaHost(),
      temperature: 0.7,
      ...overrides,
    })
  }

  private resolveOllamaHost(): string {
    if (this.isCompleteUrl) {
      return this.baseUrl
    }
    return this.baseUrl || 'http://localhost:11434'
  }
}
