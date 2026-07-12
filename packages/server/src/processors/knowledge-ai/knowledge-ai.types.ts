/** Nest ↔ Knowledge AI HTTP contracts (Python service). */

/** Vendor adapter selector — paths live inside Knowledge AI adapters, not Admin baseUrl. */
export type KnowledgeAiVendorKind = 'ollama' | 'openai_compat'

export interface KnowledgeAiProviderConfig {
  embedding_model?: string
  embedding_api_key?: string
  embedding_base_url?: string
  /** ollama → /api/embed; openai_compat → /v1/embeddings */
  embedding_provider_kind?: KnowledgeAiVendorKind
  rerank_model?: string
  rerank_api_key?: string
  rerank_base_url?: string
  /** ollama has no HTTP rerank — Knowledge AI no-ops */
  rerank_provider_kind?: KnowledgeAiVendorKind
  llm_model?: string
  llm_api_key?: string
  llm_base_url?: string
  llm_provider_kind?: KnowledgeAiVendorKind
}

export interface KnowledgeAiPromptsConfig {
  understanding?: string
  generation?: string
  guardrail?: string
}

export interface KnowledgeAiHistoryMessage {
  role: string
  content: string
}

export interface KnowledgeAiStreamRequest {
  query: string
  kb_ids: string[]
  top_k?: number
  retrieval_mode?: 'strict' | 'loose'
  history?: KnowledgeAiHistoryMessage[]
  trace_id?: string
  conversation_id?: string
  message_id?: string
  _provider?: KnowledgeAiProviderConfig
  _prompts?: KnowledgeAiPromptsConfig
}

export interface KnowledgeAiSourceItem {
  kb_id: string
  document_id: string
  chunk_id?: string | null
  content?: string | null
  score?: number | null
  parent_id?: string | null
}

export type KnowledgeAiSseEvent =
  | {
      event: 'sources'
      data: {
        sources: KnowledgeAiSourceItem[]
        retrieval_empty?: boolean
        degraded?: boolean
        conversation_id?: string
        message_id?: string
        trace_id?: string
      }
    }
  | {
      event: 'message'
      data: {
        delta?: string
        answer?: string
        conversation_id?: string
        message_id?: string
      }
    }
  | {
      event: 'message_end'
      data: {
        answer?: string
        retrieval_empty?: boolean
        degraded?: boolean
        conversation_id?: string
        message_id?: string
        trace_id?: string
      }
    }
  | {
      event: 'error'
      data: {
        message?: string
        error?: string
        conversation_id?: string
        message_id?: string
        trace_id?: string
      }
    }

export interface KnowledgeAiIndexRequest {
  document_id: string
  kb_id: string
  text: string
  metadata?: Record<string, unknown>
  trace_id?: string
  _provider?: KnowledgeAiProviderConfig
}

export interface KnowledgeAiIndexResponse {
  document_id: string
  kb_id: string
  chunk_count: number
  status: string
}

export interface KnowledgeAiDeleteResponse {
  deleted: boolean
  document_id?: string | null
  kb_id?: string | null
  pg_deleted: number
  es_deleted: number
}
