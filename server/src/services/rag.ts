import db from '../db.js'
import { getEmbedding } from './embedding.js'
import type { EmbeddingConfig } from './embedding.js'

export interface RetrievedChunk {
  content: string
  filePath: string
  score: number
}

export async function hybridSearch(
  query: string,
  knowledgeBaseIds: string[],
  embeddingConfig: EmbeddingConfig,
  topK: number = 5
): Promise<RetrievedChunk[]> {
  if (knowledgeBaseIds.length === 0) return []

  const vectorResults = await vectorSearch(query, knowledgeBaseIds, embeddingConfig, topK)
  const ftsResults = ftsSearch(query, knowledgeBaseIds, topK)
  const fused = reciprocalRankFusion(vectorResults, ftsResults, topK)
  return fused
}

async function vectorSearch(
  query: string,
  knowledgeBaseIds: string[],
  embeddingConfig: EmbeddingConfig,
  topK: number
): Promise<Array<{ chunkId: string; score: number; content: string; filePath: string }>> {
  try {
    const embeddings = await getEmbedding([query], embeddingConfig)
    const queryVec = JSON.stringify(embeddings[0])

    const allResults: Array<{ chunkId: string; score: number; content: string; filePath: string }> = []

    for (const kbId of knowledgeBaseIds) {
      const rows = db
        .prepare(
          `SELECT v.chunk_id, v.distance, d.content, d.file_path
           FROM vec_document_chunks v
           JOIN document_chunks d ON v.chunk_id = d.id
           WHERE v.embedding MATCH ? AND d.knowledge_base_id = ? AND k = ?
           ORDER BY v.distance`
        )
        .all(queryVec, kbId, topK) as Array<{
          chunk_id: string
          distance: number
          content: string
          file_path: string
        }>

      for (const row of rows) {
        allResults.push({
          chunkId: row.chunk_id,
          score: row.distance,
          content: row.content,
          filePath: row.file_path,
        })
      }
    }

    return allResults.sort((a, b) => a.score - b.score).slice(0, topK)
  } catch (err) {
    console.error('[rag] Vector search failed:', err)
    return []
  }
}

function ftsSearch(
  query: string,
  knowledgeBaseIds: string[],
  topK: number
): Array<{ chunkId: string; score: number; content: string; filePath: string }> {
  try {
    const ftsQuery = query
      .trim()
      .split(/\s+/)
      .map((w) => `"${w.replace(/"/g, '""')}"`)
      .join(' AND ')

    if (!ftsQuery) return []

    const allResults: Array<{ chunkId: string; score: number; content: string; filePath: string }> = []

    for (const kbId of knowledgeBaseIds) {
      const rows = db
        .prepare(
          `SELECT f.rowid as chunk_id, rank, d.content, d.file_path
           FROM fts_document_chunks f
           JOIN document_chunks d ON f.rowid = d.id
           WHERE d.knowledge_base_id = ? AND fts_document_chunks MATCH ?
           ORDER BY rank
           LIMIT ?`
        )
        .all(kbId, ftsQuery, topK) as Array<{
          chunk_id: string
          rank: number
          content: string
          file_path: string
        }>

      for (const row of rows) {
        allResults.push({
          chunkId: row.chunk_id,
          score: row.rank,
          content: row.content,
          filePath: row.file_path,
        })
      }
    }

    return allResults.sort((a, b) => a.score - b.score).slice(0, topK)
  } catch (err) {
    console.error('[rag] FTS search failed:', err)
    return []
  }
}

function reciprocalRankFusion(
  vectorResults: Array<{ chunkId: string; content: string; filePath: string }>,
  ftsResults: Array<{ chunkId: string; content: string; filePath: string }>,
  topK: number,
  k: number = 60
): RetrievedChunk[] {
  const scores = new Map<string, { score: number; content: string; filePath: string }>()

  for (let i = 0; i < vectorResults.length; i++) {
    const r = vectorResults[i]
    const existing = scores.get(r.chunkId)
    const rr = 1 / (k + i + 1)
    if (existing) {
      existing.score += rr
    } else {
      scores.set(r.chunkId, { score: rr, content: r.content, filePath: r.filePath })
    }
  }

  for (let i = 0; i < ftsResults.length; i++) {
    const r = ftsResults[i]
    const existing = scores.get(r.chunkId)
    const rr = 1 / (k + i + 1)
    if (existing) {
      existing.score += rr
    } else {
      scores.set(r.chunkId, { score: rr, content: r.content, filePath: r.filePath })
    }
  }

  const sorted = Array.from(scores.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, topK)

  return sorted.map(([, v]) => ({
    content: v.content,
    filePath: v.filePath,
    score: v.score,
  }))
}

export function buildRagPrompt(chunks: RetrievedChunk[], userQuery: string): string {
  if (chunks.length === 0) return userQuery

  const context = chunks
    .map((c, i) => `[${i + 1}] ${c.content}\n（来源：${c.filePath}）`)
    .join('\n\n')

  return `请根据以下参考文档回答用户问题。如果参考文档中没有相关信息，请明确说明。\n\n参考文档：\n${context}\n\n用户问题：${userQuery}`
}
