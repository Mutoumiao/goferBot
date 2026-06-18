import type { IGenerator, IRetriever } from '../interfaces.js'
import type { RuntimeDebugInfo, RuntimePipelineResult, RuntimeStage } from '../pipeline.js'
import type { Chunk, Query } from '../types.js'
import type { DefaultRetrievalPostprocessor } from './postprocessor.js'

export async function runRetrievalPipeline(
  query: Query,
  retriever: IRetriever,
  postprocessor: DefaultRetrievalPostprocessor,
  generator: IGenerator,
): Promise<RuntimePipelineResult> {
  const startTime = Date.now()
  const traceId = crypto.randomUUID()
  const stages: RuntimeStage[] = []

  // Stage 1: retrieval
  const retrievalStage: RuntimeStage = {
    name: 'retrieval',
    startTime: Date.now(),
    endTime: 0,
    input: query,
    output: null,
  }
  const candidates = await retriever.retrieve(query)
  retrievalStage.endTime = Date.now()
  retrievalStage.output = candidates
  stages.push(retrievalStage)

  // Stage 2: post-retrieval
  const postStage: RuntimeStage = {
    name: 'post-retrieval',
    startTime: Date.now(),
    endTime: 0,
    input: candidates,
    output: null,
  }
  const { candidates: processed, trace } = await postprocessor.process(candidates, query)
  postStage.endTime = Date.now()
  postStage.output = processed
  stages.push(postStage)

  // Stage 3: generation
  const chunks = processed.map((c) => c.chunk)
  const genStage: RuntimeStage = {
    name: 'generation',
    startTime: Date.now(),
    endTime: 0,
    input: { query, chunks },
    output: null,
  }
  const answer = await generator.generate({ query, chunks })
  genStage.endTime = Date.now()
  genStage.output = answer
  stages.push(genStage)

  const totalTokens = chunks.reduce(
    (sum, c) => sum + (c.tokenCount ?? Math.ceil(c.content.length / 4)),
    0,
  )

  const debugInfo: RuntimeDebugInfo = {
    traceId,
    query,
    stages,
    metrics: {
      retrievalCount: candidates.length,
      selectedCount: processed.length,
      droppedCount: candidates.length - processed.length,
      totalTokens,
      latencyMs: Date.now() - startTime,
    },
  }

  return { answer, chunks, debugInfo }
}
