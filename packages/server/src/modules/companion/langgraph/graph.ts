import type { RunnableConfig } from '@langchain/core/runnables'
import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { Injectable, Logger } from '@nestjs/common'
import type { CompanionState, NodeExecutionContext } from './interfaces.js'
import {
  EmotionNode,
  GenerateNode,
  IntentNode,
  MemoryCandidateNode,
  MemoryExtractionNode,
  PolicyNode,
  QualityGuardNode,
  RelationshipStageNode,
  RouteNode,
  SafetyNode,
  SummaryNode,
} from './nodes/index.js'

const CompanionGraphState = Annotation.Root({
  userId: Annotation<string>(),
  companionId: Annotation<string>(),
  conversationId: Annotation<string>(),
  userMessage: Annotation<string>(),
  safetyState: Annotation<CompanionState['safety']>(),
  intentState: Annotation<CompanionState['intent']>(),
  emotionState: Annotation<CompanionState['emotion']>(),
  relationshipState: Annotation<CompanionState['relationship']>(),
  routeState: Annotation<CompanionState['route']>(),
  policyState: Annotation<CompanionState['policy']>(),
  qualityState: Annotation<CompanionState['quality']>(),
  memoryCandidateState: Annotation<CompanionState['memoryCandidate']>(),
  extractedMemories: Annotation<CompanionState['extractedMemories']>(),
  summaryState: Annotation<CompanionState['summary']>(),
  assistantReply: Annotation<CompanionState['assistantReply']>(),
  partialTokens: Annotation<string | undefined>(),
  existingMemories: Annotation<CompanionState['existingMemories']>(),
  recentMessages: Annotation<CompanionState['recentMessages']>(),
  messageCount: Annotation<number | undefined>(),
  feedbacks: Annotation<CompanionState['feedbacks']>(),
  lastFallback: Annotation<string | undefined>(),
})

type Branch = 'continue' | 'end_safety' | 'skip_memory'

const _REQUIRED_FIELDS: Array<keyof CompanionState> = [
  'safety',
  'intent',
  'emotion',
  'relationship',
  'route',
  'policy',
  'quality',
]

@Injectable()
export class CompanionGraphService {
  private readonly logger = new Logger(CompanionGraphService.name)
  private readonly graph: ReturnType<StateGraph<typeof CompanionGraphState>['compile']>

  constructor(
    readonly safetyNode: SafetyNode,
    readonly intentNode: IntentNode,
    readonly emotionNode: EmotionNode,
    readonly relationshipNode: RelationshipStageNode,
    readonly routeNode: RouteNode,
    readonly policyNode: PolicyNode,
    readonly generateNode: GenerateNode,
    readonly qualityNode: QualityGuardNode,
    readonly summaryNode: SummaryNode,
    readonly memoryCandidateNode: MemoryCandidateNode,
    readonly memoryExtractionNode: MemoryExtractionNode,
  ) {
    this.graph = this.buildGraph({
      safety: safetyNode,
      intent: intentNode,
      emotion: emotionNode,
      relationship: relationshipNode,
      route: routeNode,
      policy: policyNode,
      generate: generateNode,
      quality: qualityNode,
      summary: summaryNode,
      memoryCandidate: memoryCandidateNode,
      memoryExtraction: memoryExtractionNode,
    })
  }

  getGraph() {
    return this.graph
  }

  async *stream(
    initialState: CompanionState,
    ctx: NodeExecutionContext,
  ): AsyncGenerator<{ node: string; patch: Partial<CompanionState> }> {
    const rawStream = await this.graph.stream(initialState as never, {
      configurable: {
        companionName: ctx.companionName,
        companionPersonality: ctx.companionPersonality,
        companionTone: ctx.companionTone,
        companionBoundaries: ctx.companionBoundaries,
        companionGuardrails: ctx.companionGuardrails,
        companionDefaultPrompt: ctx.companionDefaultPrompt,
      },
      signal: ctx.signal,
      streamMode: 'updates',
    })

    const stream = rawStream as AsyncIterable<{ [node: string]: Partial<CompanionState> }>
    for await (const chunk of stream) {
      for (const [node, patch] of Object.entries(chunk)) {
        this.logger.log(`[graph] step=${node}_done`)
        yield { node, patch: patch as Partial<CompanionState> }
      }
    }
  }

  private buildGraph(nodes: {
    safety: SafetyNode
    intent: IntentNode
    emotion: EmotionNode
    relationship: RelationshipStageNode
    route: RouteNode
    policy: PolicyNode
    generate: GenerateNode
    quality: QualityGuardNode
    summary: SummaryNode
    memoryCandidate: MemoryCandidateNode
    memoryExtraction: MemoryExtractionNode
  }) {
    const builder = new StateGraph(CompanionGraphState)

    builder.addNode('safety', (state: CompanionState, config: RunnableConfig) =>
      this.runNode('safety', nodes.safety, state, config),
    )
    builder.addNode('intent', (state: CompanionState, config: RunnableConfig) =>
      this.runNode('intent', nodes.intent, state, config),
    )
    builder.addNode('emotion', (state: CompanionState, config: RunnableConfig) =>
      this.runNode('emotion', nodes.emotion, state, config),
    )
    builder.addNode('relationship', (state: CompanionState, config: RunnableConfig) =>
      this.runNode('relationship', nodes.relationship, state, config),
    )
    builder.addNode('route', (state: CompanionState, config: RunnableConfig) =>
      this.runNode('route', nodes.route, state, config),
    )
    builder.addNode('policy', (state: CompanionState, config: RunnableConfig) =>
      this.runNode('policy', nodes.policy, state, config),
    )
    builder.addNode('generate', (state: CompanionState, config: RunnableConfig) =>
      this.runNode('generate', nodes.generate, state, config),
    )
    builder.addNode('quality', (state: CompanionState, config: RunnableConfig) =>
      this.runNode('quality', nodes.quality, state, config),
    )
    builder.addNode('summary', (state: CompanionState, config: RunnableConfig) =>
      this.runNode('summary', nodes.summary, state, config),
    )
    builder.addNode('memory_candidate', (state: CompanionState, config: RunnableConfig) =>
      this.runNode('memory_candidate', nodes.memoryCandidate, state, config),
    )
    builder.addNode('memory_extraction', (state: CompanionState, config: RunnableConfig) =>
      this.runNode('memory_extraction', nodes.memoryExtraction, state, config),
    )

    builder.addEdge(START as never, 'safety' as never)

    builder.addConditionalEdges(
      'safety' as never,
      (state: CompanionState): Branch => {
        const action = state.safety?.boundaryAction
        if (action === 'refuse' || action === 'crisis_support') {
          this.logger.log('[graph] step=safety_blocked')
          return 'end_safety'
        }
        return 'continue'
      },
      {
        continue: 'intent' as never,
        end_safety: END as never,
      },
    )

    builder.addEdge('intent' as never, 'emotion' as never)
    builder.addEdge('emotion' as never, 'relationship' as never)
    builder.addEdge('relationship' as never, 'route' as never)
    builder.addEdge('route' as never, 'policy' as never)
    builder.addEdge('policy' as never, 'generate' as never)
    builder.addEdge('generate' as never, 'quality' as never)
    // Quality 为观测型：fail 仍继续 summary/memory，主回复由 stream 落库（gap G-QL-01）
    builder.addEdge('quality' as never, 'summary' as never)

    builder.addEdge('summary' as never, 'memory_candidate' as never)

    builder.addConditionalEdges(
      'memory_candidate' as never,
      (state: CompanionState): Branch => {
        if (state.memoryCandidate?.shouldExtract) {
          return 'continue'
        }
        this.logger.log('[graph] step=memory_skip')
        return 'skip_memory'
      },
      {
        continue: 'memory_extraction' as never,
        skip_memory: END as never,
      },
    )

    builder.addEdge('memory_extraction' as never, END as never)

    return builder.compile({ checkpointer: undefined })
  }

  private async runNode(
    name: string,
    node: {
      execute(state: CompanionState, ctx: NodeExecutionContext): Promise<Partial<CompanionState>>
    },
    state: CompanionState,
    config?: RunnableConfig,
  ): Promise<Partial<CompanionState>> {
    const conf = (config?.configurable ?? {}) as Record<string, unknown>
    const ctx: NodeExecutionContext = {
      userId: state.userId,
      companionId: state.companionId,
      conversationId: state.conversationId,
      companionName: (conf.companionName as string) || 'Companion',
      companionPersonality: conf.companionPersonality as string | undefined,
      companionTone: conf.companionTone as string | undefined,
      companionBoundaries: conf.companionBoundaries as string | undefined,
      companionGuardrails: conf.companionGuardrails as string | undefined,
      companionDefaultPrompt: conf.companionDefaultPrompt as string | undefined,
      signal: config?.signal as AbortSignal | undefined,
    }
    this.logger.log(`[graph] step=${name}_start`)
    const next = await node.execute(state, ctx)
    this.logger.log(`[graph] step=${name}_done`)
    return next
  }
}

export { CompanionGraphState }
