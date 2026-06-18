/**
 * Pipeline 类型抽象
 *
 * 定义索引流水线和检索流水线的类型级契约。
 */

import type { Chunk, DocumentSource, Query } from './types.js'

export interface IndexingStage {
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  error?: string
}

export interface IndexingResult {
  chunks: Chunk[]
  vectorCount: number
  stages: IndexingStage[]
}

export type IndexingPipeline = (document: DocumentSource) => Promise<IndexingResult>

export interface RuntimeStage {
  name: string
  startTime: number
  endTime: number
  input: unknown
  output: unknown
  error?: string
}

export interface RuntimeDebugInfo {
  traceId: string
  query: Query
  stages: RuntimeStage[]
  metrics: {
    retrievalCount: number
    selectedCount: number
    droppedCount: number
    totalTokens: number
    latencyMs: number
  }
}

export interface RuntimePipelineResult {
  answer: string
  chunks: Chunk[]
  debugInfo: RuntimeDebugInfo
}

export type RuntimePipeline = (query: Query) => Promise<RuntimePipelineResult>
