import fs from 'node:fs'
import path from 'node:path'
import { nanoid } from 'nanoid'
import { TextLoader } from 'langchain/document_loaders/fs/text'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import db from '../db.js'
import { getEmbedding } from './embedding.js'
import type { EmbeddingConfig } from './embedding.js'
import { getAppDataDir } from '../utils.js'

export interface IndexTask {
  knowledgeBaseId: string
  filePath: string
  relativePath: string
}

const queue: IndexTask[] = []
let isProcessing = false

export function enqueueIndexTask(task: IndexTask): void {
  queue.push(task)
  if (!isProcessing) {
    processQueue()
  }
}

export function enqueueKnowledgeBase(knowledgeBaseId: string, kbPath: string): void {
  if (!fs.existsSync(kbPath)) return
  const files = collectFiles(kbPath, kbPath)
  for (const f of files) {
    enqueueIndexTask({ knowledgeBaseId, filePath: f.absolute, relativePath: f.relative })
  }
}

function collectFiles(dir: string, root: string): Array<{ absolute: string; relative: string }> {
  const results: Array<{ absolute: string; relative: string }> = []
  if (!fs.existsSync(dir)) return results
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name)
    const relative = path.relative(root, absolute)
    if (entry.isDirectory()) {
      results.push(...collectFiles(absolute, root))
    } else {
      results.push({ absolute, relative })
    }
  }
  return results
}

async function processQueue(): Promise<void> {
  if (isProcessing) return
  isProcessing = true

  while (queue.length > 0) {
    const task = queue.shift()
    if (!task) continue
    try {
      await indexFile(task)
    } catch (err) {
      console.error('[indexer] Failed to index file:', task.filePath, err)
    }
  }

  isProcessing = false
}

async function indexFile(task: IndexTask): Promise<void> {
  const loader = new TextLoader(task.filePath)
  const docs = await loader.load()
  const fullText = docs.map((d) => d.pageContent).join('\n')
  if (!fullText.trim()) return

  deleteExistingChunks(task.knowledgeBaseId, task.relativePath)

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  })
  const chunks = await splitter.splitText(fullText)
  if (chunks.length === 0) return

  const embeddingConfig = getEmbeddingConfigFromSettings()
  let embeddings: number[][] = []
  if (embeddingConfig) {
    try {
      embeddings = await getEmbedding(chunks, embeddingConfig)
    } catch (err) {
      console.error('[indexer] Embedding failed for', task.relativePath, err)
    }
  }

  const insertChunk = db.prepare(
    `INSERT INTO document_chunks (id, knowledge_base_id, file_path, content, embedding, chunk_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )

  const insertVec = db.prepare(
    `INSERT INTO vec_document_chunks (chunk_id, embedding) VALUES (?, ?)`
  )

  const insertFts = db.prepare(
    `INSERT INTO fts_document_chunks (content, file_path) VALUES (?, ?)`
  )

  const now = Date.now()
  for (let i = 0; i < chunks.length; i++) {
    const chunkId = nanoid()
    const embeddingBlob = embeddings[i] ? Buffer.from(new Float32Array(embeddings[i]).buffer) : null

    insertChunk.run(chunkId, task.knowledgeBaseId, task.relativePath, chunks[i], embeddingBlob, i, now)
    if (embeddings[i]) {
      insertVec.run(chunkId, JSON.stringify(embeddings[i]))
    } else {
      insertVec.run(chunkId, JSON.stringify([]))
    }
    insertFts.run(chunks[i], task.relativePath)
  }

  console.log(`[indexer] Indexed ${chunks.length} chunks for ${task.relativePath}`)
}

function deleteExistingChunks(knowledgeBaseId: string, relativePath: string): void {
  const rows = db
    .prepare('SELECT id FROM document_chunks WHERE knowledge_base_id = ? AND file_path = ?')
    .all(knowledgeBaseId, relativePath) as Array<{ id: string }>

  for (const row of rows) {
    db.prepare('DELETE FROM document_chunks WHERE id = ?').run(row.id)
    db.prepare('DELETE FROM vec_document_chunks WHERE chunk_id = ?').run(row.id)
    db.prepare('DELETE FROM fts_document_chunks WHERE rowid = ?').run(row.id)
  }
}

function getEmbeddingConfigFromSettings(): EmbeddingConfig | null {
  const configPath = path.join(getAppDataDir(), 'config.json')
  if (!fs.existsSync(configPath)) return null
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    const ec = config.embeddingProvider
    if (!ec || !ec.apiKey) return null
    return {
      provider: ec.provider || 'openai',
      model: ec.model || 'text-embedding-3-small',
      baseUrl: ec.baseUrl || '',
      apiKey: ec.apiKey,
    }
  } catch {
    return null
  }
}

export function getQueueLength(): number {
  return queue.length
}

export function getIndexStatus(knowledgeBaseId: string): { totalFiles: number; indexedFiles: number; pendingFiles: number } {
  const indexedResult = db
    .prepare('SELECT COUNT(DISTINCT file_path) as count FROM document_chunks WHERE knowledge_base_id = ?')
    .get(knowledgeBaseId) as { count: number } | undefined

  const kb = db.prepare('SELECT path FROM knowledge_bases WHERE id = ?').get(knowledgeBaseId) as { path: string } | undefined
  let totalFiles = 0
  if (kb && fs.existsSync(kb.path)) {
    totalFiles = countFilesRecursively(kb.path)
  }

  return {
    totalFiles,
    indexedFiles: indexedResult?.count ?? 0,
    pendingFiles: getQueueLength(),
  }
}

function countFilesRecursively(dir: string): number {
  if (!fs.existsSync(dir)) return 0
  let count = 0
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      count += countFilesRecursively(full)
    } else {
      count++
    }
  }
  return count
}
