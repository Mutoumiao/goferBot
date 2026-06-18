import type { IChunker, IEmbedder, IIndexer } from '../interfaces.js'
import type { IndexingResult, IndexingStage } from '../pipeline.js'
import type { Chunk, DocumentSource, TokenUsage } from '../types.js'

export interface RunIndexingOptions {
  chunker: IChunker
  embedder: IEmbedder
  indexer: IIndexer
  onStageChange?: (stages: IndexingStage[]) => void | Promise<void>
}

export async function runIndexing(
  document: DocumentSource,
  options: RunIndexingOptions,
): Promise<IndexingResult> {
  const { chunker, embedder, indexer, onStageChange } = options

  const stages: IndexingStage[] = [
    { name: 'chunk', status: 'pending' },
    { name: 'embed', status: 'pending' },
    { name: 'index', status: 'pending' },
  ]

  async function notify() {
    if (onStageChange) {
      await onStageChange([...stages])
    }
  }

  let chunks: Chunk[] = []
  let vectors: number[][] = []
  let usage: TokenUsage[] | undefined

  try {
    // Stage 1: chunk
    stages[0].status = 'running'
    await notify()
    chunks = await chunker.chunk(document)
    stages[0].status = 'completed'
    await notify()

    // Stage 2: embed
    stages[1].status = 'running'
    await notify()
    if ('embedWithUsage' in embedder && typeof embedder.embedWithUsage === 'function') {
      const embedResult = await embedder.embedWithUsage(chunks.map((c) => c.content))
      vectors = embedResult.vectors
      usage = embedResult.usage
    } else {
      vectors = await embedder.embed(chunks.map((c) => c.content))
    }
    stages[1].status = 'completed'
    await notify()

    // Stage 3: index
    stages[2].status = 'running'
    await notify()
    await indexer.index(chunks, vectors, usage)
    stages[2].status = 'completed'
    await notify()
  } catch (error) {
    const current = stages.find((s) => s.status === 'running')
    if (current) {
      current.status = 'failed'
      current.error = error instanceof Error ? error.message : String(error)
      await notify()
    }
    throw error
  }

  return {
    chunks,
    vectorCount: vectors.length,
    stages,
  }
}
