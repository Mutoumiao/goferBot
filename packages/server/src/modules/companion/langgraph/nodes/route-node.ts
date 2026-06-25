import { emotionRouteSchema, fallbackEmotionRoute } from '@goferbot/data/schemas'
import { Injectable, Logger } from '@nestjs/common'
import type {
  CompanionState,
  EmotionResult,
  IntentResult,
  NodeExecutionContext,
  RelationshipResult,
  RouteResult,
} from '../interfaces.js'

interface RouteRule {
  when: {
    intent?: IntentResult['primary']
    emotion?: EmotionResult['primaryEmotion']
    relationship?: RelationshipResult['stage']
  }
  route: RouteResult['route']
  responseLength: RouteResult['responseLength']
  shouldAskQuestion: boolean
  shouldGiveAdvice: boolean
  shouldUsePetName: boolean
  shouldMirrorEmotion: boolean
  routeGuidance: string
}

const ROUTE_RULES: RouteRule[] = [
  {
    when: { intent: 'emotional_support', emotion: 'sad', relationship: 'trusted_companion' },
    route: 'deep_comfort',
    responseLength: 'medium',
    shouldAskQuestion: false,
    shouldGiveAdvice: false,
    shouldUsePetName: true,
    shouldMirrorEmotion: true,
    routeGuidance: '先默默承接情绪，再温和地表达陪伴感；不要急于给建议。',
  },
  {
    when: { intent: 'emotional_support', emotion: 'anxious', relationship: 'boundary_sensitive' },
    route: 'calm_deescalation',
    responseLength: 'short',
    shouldAskQuestion: false,
    shouldGiveAdvice: false,
    shouldUsePetName: false,
    shouldMirrorEmotion: true,
    routeGuidance: '保持冷静、稳定、低压力的语气；帮助用户降温。',
  },
  {
    when: { intent: 'emotional_support', emotion: 'angry', relationship: 'repairing' },
    route: 'relationship_repair',
    responseLength: 'short',
    shouldAskQuestion: false,
    shouldGiveAdvice: false,
    shouldUsePetName: false,
    shouldMirrorEmotion: false,
    routeGuidance: '先承担、先道歉、不辩解；以修复关系为第一目标。',
  },
  {
    when: { intent: 'casual_chat', emotion: 'happy', relationship: 'warming_up' },
    route: 'playful_flirt',
    responseLength: 'short',
    shouldAskQuestion: true,
    shouldGiveAdvice: false,
    shouldUsePetName: false,
    shouldMirrorEmotion: true,
    routeGuidance: '轻松、俏皮、有节制地互动；不要过度暧昧。',
  },
  {
    when: { intent: 'casual_chat', emotion: 'playful', relationship: 'comfortable_chat' },
    route: 'light_companion',
    responseLength: 'short',
    shouldAskQuestion: true,
    shouldGiveAdvice: false,
    shouldUsePetName: false,
    shouldMirrorEmotion: true,
    routeGuidance: '自然、轻松地陪伴；适度提问保持互动。',
  },
  {
    when: { intent: 'life_sharing', emotion: 'neutral', relationship: 'comfortable_chat' },
    route: 'light_companion',
    responseLength: 'medium',
    shouldAskQuestion: true,
    shouldGiveAdvice: false,
    shouldUsePetName: false,
    shouldMirrorEmotion: true,
    routeGuidance: '认真倾听、适时回应；鼓励用户分享。',
  },
  {
    when: { intent: 'relationship_advice', emotion: 'confused', relationship: 'repairing' },
    route: 'relationship_repair',
    responseLength: 'medium',
    shouldAskQuestion: true,
    shouldGiveAdvice: true,
    shouldUsePetName: false,
    shouldMirrorEmotion: false,
    routeGuidance: '先澄清，再温和地给出一个建议；不要说教。',
  },
  {
    when: { intent: 'companionship_presence', emotion: 'lonely', relationship: 'new_connection' },
    route: 'quiet_presence',
    responseLength: 'very_short',
    shouldAskQuestion: false,
    shouldGiveAdvice: false,
    shouldUsePetName: false,
    shouldMirrorEmotion: true,
    routeGuidance: '安静陪伴，不要打扰；让用户感受到"我在"。',
  },
  {
    when: { intent: 'life_sharing', emotion: 'stressed', relationship: 'trusted_companion' },
    route: 'practical_support',
    responseLength: 'medium',
    shouldAskQuestion: true,
    shouldGiveAdvice: true,
    shouldUsePetName: false,
    shouldMirrorEmotion: false,
    routeGuidance: '先共情，再给一个具体、可执行的小建议。',
  },
  {
    when: { intent: 'unclear', emotion: 'confused', relationship: 'new_connection' },
    route: 'gentle_clarification',
    responseLength: 'short',
    shouldAskQuestion: true,
    shouldGiveAdvice: false,
    shouldUsePetName: false,
    shouldMirrorEmotion: false,
    routeGuidance: '先温和承接，再用一个轻问题确认用户想继续聊什么。',
  },
  {
    when: { intent: 'romantic_flirt', emotion: 'affectionate', relationship: 'close_bond' },
    route: 'playful_flirt',
    responseLength: 'short',
    shouldAskQuestion: true,
    shouldGiveAdvice: false,
    shouldUsePetName: true,
    shouldMirrorEmotion: true,
    routeGuidance: '温柔、适度、有边界地回应；不要越界。',
  },
  {
    when: { intent: 'memory_update', emotion: 'neutral', relationship: 'comfortable_chat' },
    route: 'gentle_clarification',
    responseLength: 'short',
    shouldAskQuestion: false,
    shouldGiveAdvice: false,
    shouldUsePetName: false,
    shouldMirrorEmotion: false,
    routeGuidance: '确认收到并温和回应。',
  },
  {
    when: { intent: 'agent_feedback', emotion: 'neutral', relationship: 'warming_up' },
    route: 'relationship_repair',
    responseLength: 'short',
    shouldAskQuestion: true,
    shouldGiveAdvice: false,
    shouldUsePetName: false,
    shouldMirrorEmotion: false,
    routeGuidance: '先感谢，再温和确认如何可以更好。',
  },
  {
    when: { intent: 'conversation_repair', emotion: 'disappointed', relationship: 'repairing' },
    route: 'relationship_repair',
    responseLength: 'medium',
    shouldAskQuestion: true,
    shouldGiveAdvice: false,
    shouldUsePetName: false,
    shouldMirrorEmotion: false,
    routeGuidance: '先道歉、倾听、确认理解，再温和修复。',
  },
  {
    when: { intent: 'creative_request', emotion: 'playful', relationship: 'comfortable_chat' },
    route: 'light_companion',
    responseLength: 'medium',
    shouldAskQuestion: false,
    shouldGiveAdvice: false,
    shouldUsePetName: false,
    shouldMirrorEmotion: false,
    routeGuidance: '投入、有创意地回应；与用户共创。',
  },
]

@Injectable()
export class RouteNode {
  private readonly logger = new Logger(RouteNode.name)

  async execute(
    state: CompanionState,
    _ctx: NodeExecutionContext,
  ): Promise<Partial<CompanionState>> {
    const intent = state.intent?.primary
    const emotion = state.emotion?.primaryEmotion
    const relationship = state.relationship?.stage

    const rule = ROUTE_RULES.find((r) => {
      const w = r.when
      return (
        (!w.intent || w.intent === intent) &&
        (!w.emotion || w.emotion === emotion) &&
        (!w.relationship || w.relationship === relationship)
      )
    })

    if (!rule) {
      this.logger.debug(
        `[routeNode] no rule matched intent=${intent} emotion=${emotion} relationship=${relationship}`,
      )
      return { route: fallbackEmotionRoute }
    }

    this.logger.debug(`[routeNode] matched rule route=${rule.route}`)
    const result = emotionRouteSchema.parse({
      route: rule.route,
      responseLength: rule.responseLength,
      shouldAskQuestion: rule.shouldAskQuestion,
      shouldGiveAdvice: rule.shouldGiveAdvice,
      shouldUsePetName: rule.shouldUsePetName,
      shouldMirrorEmotion: rule.shouldMirrorEmotion,
      routeGuidance: rule.routeGuidance,
    }) as RouteResult
    return { route: result }
  }
}
