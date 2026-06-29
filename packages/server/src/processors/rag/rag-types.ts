import type { GroundingResult } from './grounding.service.js'

export type RetrievalMode = 'vector' | 'bm25' | 'hybrid'

export type RagMetadataValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | boolean[]
  | Array<string | number | boolean>

export interface RagMetadataFilter {
  [key: string]: RagMetadataValue
}

export interface RagRetrieveOptions {
  kbIds?: string[]
  documentIds?: string[]
  topK?: number
  candidateK?: number
  minScore?: number
  mode?: RetrievalMode
  vectorWeight?: number
  bm25Weight?: number
  rrfK?: number
  needRerank?: boolean
  rerankTopK?: number
  metadata?: RagMetadataFilter
  userId?: string
  userTeams?: string[]
  resolveParents?: boolean
  skipRouter?: boolean
}

export interface RagQueryOptions extends RagRetrieveOptions {
  systemPrompt?: string
}

export interface RetrievedChunk {
  id: string
  documentId: string
  kbId: string
  content: string
  chunkIndex: number
  score: number
}

export interface RagQueryResult {
  answer: string
  grounding: GroundingResult[]
}
