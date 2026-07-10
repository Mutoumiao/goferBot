import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type {
  KnowledgeAiDeleteResponse,
  KnowledgeAiIndexRequest,
  KnowledgeAiIndexResponse,
  KnowledgeAiSseEvent,
  KnowledgeAiStreamRequest,
} from './knowledge-ai.types.js'

export interface KnowledgeAiClientOptions {
  /** Connection / first-byte timeout (ms) */
  connectTimeoutMs?: number
  /** Full generation timeout (ms) */
  generationTimeoutMs?: number
  signal?: AbortSignal
}

@Injectable()
export class KnowledgeAiClient {
  private readonly logger = new Logger(KnowledgeAiClient.name)

  constructor(private readonly config: ConfigService) {}

  get baseUrl(): string {
    // Canonical: KNOWLEDGE_AI_BASE_URL. KNOWLEDGE_AI_URL kept as legacy alias only.
    const canonical = this.config.get<string>('KNOWLEDGE_AI_BASE_URL')
    const legacy = this.config.get<string>('KNOWLEDGE_AI_URL')
    if (!canonical && legacy) {
      this.logger.warn('KNOWLEDGE_AI_URL is deprecated; use KNOWLEDGE_AI_BASE_URL')
    }
    return (canonical || legacy || 'http://127.0.0.1:8090').replace(/\/$/, '')
  }

  get serviceToken(): string {
    return this.config.get<string>('KNOWLEDGE_AI_SERVICE_TOKEN') || ''
  }

  get connectTimeoutMs(): number {
    return Number(this.config.get('KNOWLEDGE_AI_CONNECT_TIMEOUT_MS') ?? 15_000)
  }

  get generationTimeoutMs(): number {
    return Number(this.config.get('KNOWLEDGE_AI_GENERATION_TIMEOUT_MS') ?? 180_000)
  }

  private authHeaders(): Record<string, string> {
    // Fail closed: never call Knowledge AI without a shared secret (avoids accidental open access).
    if (!this.serviceToken) {
      this.logger.error('KNOWLEDGE_AI_SERVICE_TOKEN is empty')
      throw new ServiceUnavailableException('Knowledge AI service token is not configured')
    }
    return {
      Authorization: `Bearer ${this.serviceToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  }

  /**
   * Merge multiple AbortSignals into one (Node 18+ without relying on AbortSignal.any).
   */
  private mergeSignals(...signals: Array<AbortSignal | undefined>): {
    signal: AbortSignal
    dispose: () => void
  } {
    const controller = new AbortController()
    const cleanups: Array<() => void> = []

    for (const s of signals) {
      if (!s) continue
      if (s.aborted) {
        controller.abort()
        break
      }
      const onAbort = () => controller.abort()
      s.addEventListener('abort', onAbort)
      cleanups.push(() => s.removeEventListener('abort', onAbort))
    }

    return {
      signal: controller.signal,
      dispose: () => {
        for (const c of cleanups) c()
      },
    }
  }

  async health(): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(this.connectTimeoutMs),
    })
    if (!res.ok) {
      throw new ServiceUnavailableException(`Knowledge AI health failed: ${res.status}`)
    }
    return res.json()
  }

  async index(body: KnowledgeAiIndexRequest, opts?: KnowledgeAiClientOptions): Promise<KnowledgeAiIndexResponse> {
    return this.postJson<KnowledgeAiIndexResponse>('/index', body, opts)
  }

  async deleteDocument(
    documentId: string,
    opts?: KnowledgeAiClientOptions,
  ): Promise<KnowledgeAiDeleteResponse> {
    return this.deleteJson<KnowledgeAiDeleteResponse>(`/documents/${documentId}`, opts)
  }

  async deleteKb(kbId: string, opts?: KnowledgeAiClientOptions): Promise<KnowledgeAiDeleteResponse> {
    return this.deleteJson<KnowledgeAiDeleteResponse>(`/kb/${kbId}`, opts)
  }

  /**
   * Stream knowledge Q&A SSE from Python; byte-level passthrough parsing of event frames.
   * Layered timeouts:
   * - connectTimeoutMs: abort if response headers not received in time
   * - generationTimeoutMs: covers the whole stream after connect
   */
  async *stream(
    body: KnowledgeAiStreamRequest,
    opts?: KnowledgeAiClientOptions,
  ): AsyncGenerator<KnowledgeAiSseEvent> {
    const connectMs = opts?.connectTimeoutMs ?? this.connectTimeoutMs
    const genMs = opts?.generationTimeoutMs ?? this.generationTimeoutMs
    const userSignal = opts?.signal

    const streamController = new AbortController()
    const genTimer = setTimeout(() => streamController.abort(), genMs)
    const onUserAbort = () => streamController.abort()
    userSignal?.addEventListener('abort', onUserAbort)

    const connectController = new AbortController()
    const connectTimer = setTimeout(() => connectController.abort(), connectMs)
    // User/gen abort during connect should cancel the fetch as well
    const unlinkStreamToConnect = this.linkAbort(streamController.signal, connectController)

    const fetchMerged = this.mergeSignals(connectController.signal, streamController.signal)

    try {
      const res = await fetch(`${this.baseUrl}/stream`, {
        method: 'POST',
        headers: {
          ...this.authHeaders(),
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: fetchMerged.signal,
      })

      // Headers received — connect budget done; stream uses gen/user abort only.
      clearTimeout(connectTimer)
      unlinkStreamToConnect()
      fetchMerged.dispose()

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '')
        throw new ServiceUnavailableException(
          `Knowledge AI stream failed: ${res.status} ${text.slice(0, 200)}`,
        )
      }

      yield* this.parseSse(res.body, streamController.signal)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err
      }
      this.logger.error(
        `Knowledge AI stream error: ${err instanceof Error ? err.message : 'unknown'}`,
      )
      throw err
    } finally {
      clearTimeout(connectTimer)
      clearTimeout(genTimer)
      unlinkStreamToConnect()
      fetchMerged.dispose()
      userSignal?.removeEventListener('abort', onUserAbort)
    }
  }

  private linkAbort(source: AbortSignal, target: AbortController): () => void {
    if (source.aborted) {
      target.abort()
      return () => {}
    }
    const onAbort = () => target.abort()
    source.addEventListener('abort', onAbort)
    return () => source.removeEventListener('abort', onAbort)
  }

  private async *parseSse(
    body: ReadableStream<Uint8Array>,
    signal: AbortSignal,
  ): AsyncGenerator<KnowledgeAiSseEvent> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let eventName = 'message'
    let dataLines: string[] = []

    try {
      while (true) {
        if (signal.aborted) break
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let idx: number
        while ((idx = buffer.indexOf('\n')) >= 0) {
          let line = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 1)
          if (line.endsWith('\r')) line = line.slice(0, -1)

          if (line === '') {
            if (dataLines.length > 0) {
              const raw = dataLines.join('\n')
              dataLines = []
              try {
                const data = JSON.parse(raw) as KnowledgeAiSseEvent['data']
                yield {
                  event: eventName as KnowledgeAiSseEvent['event'],
                  data,
                } as KnowledgeAiSseEvent
              } catch {
                this.logger.warn('Skip bad SSE JSON frame')
              }
            }
            eventName = 'message'
            continue
          }

          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart())
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  private async postJson<T>(
    path: string,
    body: unknown,
    opts?: KnowledgeAiClientOptions,
  ): Promise<T> {
    const timeout = opts?.generationTimeoutMs ?? this.generationTimeoutMs
    const signal = opts?.signal ?? AbortSignal.timeout(timeout)
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body),
      signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new ServiceUnavailableException(
        `Knowledge AI ${path} failed: ${res.status} ${text.slice(0, 200)}`,
      )
    }
    return (await res.json()) as T
  }

  private async deleteJson<T>(path: string, opts?: KnowledgeAiClientOptions): Promise<T> {
    const timeout = opts?.connectTimeoutMs ?? this.connectTimeoutMs
    const signal = opts?.signal ?? AbortSignal.timeout(timeout)
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
      signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new ServiceUnavailableException(
        `Knowledge AI DELETE ${path} failed: ${res.status} ${text.slice(0, 200)}`,
      )
    }
    return (await res.json()) as T
  }
}
