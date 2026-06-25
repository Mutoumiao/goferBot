import { fallbackReplyPolicy, replyPolicySchema } from '@goferbot/data/schemas'
import { Injectable, Logger } from '@nestjs/common'
import type { CompanionState, NodeExecutionContext, PolicyResult } from '../interfaces.js'

type ForbiddenMove =
  | 'lecture'
  | 'over_explain'
  | 'multiple_questions'
  | 'premature_advice'
  | 'intense_flirt'
  | 'diagnose_user'
  | 'take_sides_aggressively'
  | 'pressure_to_disclose'
  | 'promise_real_world_action'
  | 'expose_internal_labels'

interface PolicyPack {
  policy: string
  sentenceBudget: { min: number; max: number }
  rhythm: string
  openingMove: string
  allowedMoves: string[]
  forbiddenMoves: ForbiddenMove[]
  questionLimit: number
  adviceLimit: number
  intimacyLevel: string
  styleGuidance: string
}

const POLICY_PACKS: Record<string, PolicyPack> = {
  deep_comfort: {
    policy: 'deep_empathy',
    sentenceBudget: { min: 2, max: 4 },
    rhythm: 'soft',
    openingMove: 'comfort',
    allowedMoves: ['validate_feeling', 'mirror_emotion', 'offer_presence'],
    forbiddenMoves: [
      'lecture',
      'over_explain',
      'multiple_questions',
      'premature_advice',
      'diagnose_user',
      'expose_internal_labels',
    ],
    questionLimit: 0,
    adviceLimit: 0,
    intimacyLevel: 'medium',
    styleGuidance: '先默默承接情绪，再温和地表达陪伴感；不要急于给建议，不要问太多问题。',
  },
  calm_deescalation: {
    policy: 'calm_boundary',
    sentenceBudget: { min: 1, max: 3 },
    rhythm: 'still',
    openingMove: 'acknowledge',
    allowedMoves: ['validate_feeling', 'offer_presence', 'set_soft_boundary'],
    forbiddenMoves: [
      'lecture',
      'over_explain',
      'intense_flirt',
      'diagnose_user',
      'pressure_to_disclose',
      'expose_internal_labels',
    ],
    questionLimit: 0,
    adviceLimit: 0,
    intimacyLevel: 'low',
    styleGuidance: '保持冷静、稳定、低压力的语气；帮助用户降温，不要刺激情绪。',
  },
  relationship_repair: {
    policy: 'relationship_repair',
    sentenceBudget: { min: 1, max: 3 },
    rhythm: 'soft',
    openingMove: 'apologize',
    allowedMoves: ['apologize', 'validate_feeling', 'ask_one_question', 'repair_misunderstanding'],
    forbiddenMoves: ['lecture', 'over_explain', 'multiple_questions'],
    questionLimit: 1,
    adviceLimit: 0,
    intimacyLevel: 'medium',
    styleGuidance: '先承担、先道歉、不辩解；倾听优先，以修复关系为目标。',
  },
  playful_flirt: {
    policy: 'playful_flirt',
    sentenceBudget: { min: 1, max: 3 },
    rhythm: 'lively',
    openingMove: 'play',
    allowedMoves: ['light_tease', 'mirror_emotion', 'ask_one_question', 'use_pet_name'],
    forbiddenMoves: [
      'intense_flirt',
      'pressure_to_disclose',
      'premature_advice',
      'lecture',
      'diagnose_user',
      'promise_real_world_action',
    ],
    questionLimit: 1,
    adviceLimit: 0,
    intimacyLevel: 'medium',
    styleGuidance: '轻松、俏皮、有节制地互动；不要越界，不要给压力。',
  },
  light_companion: {
    policy: 'warm_companion',
    sentenceBudget: { min: 1, max: 3 },
    rhythm: 'natural',
    openingMove: 'acknowledge',
    allowedMoves: ['validate_feeling', 'ask_one_question', 'mirror_emotion', 'offer_presence'],
    forbiddenMoves: [
      'lecture',
      'over_explain',
      'multiple_questions',
      'premature_advice',
      'expose_internal_labels',
    ],
    questionLimit: 1,
    adviceLimit: 0,
    intimacyLevel: 'low',
    styleGuidance: '自然、轻松地陪伴；适度提问保持互动，不要给压力。',
  },
  quiet_presence: {
    policy: 'quiet_presence',
    sentenceBudget: { min: 1, max: 2 },
    rhythm: 'still',
    openingMove: 'acknowledge',
    allowedMoves: ['offer_presence', 'validate_feeling'],
    forbiddenMoves: [
      'lecture',
      'over_explain',
      'multiple_questions',
      'premature_advice',
      'pressure_to_disclose',
      'expose_internal_labels',
    ],
    questionLimit: 0,
    adviceLimit: 0,
    intimacyLevel: 'low',
    styleGuidance: '安静陪伴，不要打扰；让用户感受到"我在"。',
  },
  practical_support: {
    policy: 'practical_support',
    sentenceBudget: { min: 2, max: 4 },
    rhythm: 'focused',
    openingMove: 'acknowledge',
    allowedMoves: ['validate_feeling', 'give_one_suggestion', 'ask_one_question'],
    forbiddenMoves: [
      'lecture',
      'over_explain',
      'multiple_questions',
      'premature_advice',
      'diagnose_user',
      'promise_real_world_action',
    ],
    questionLimit: 1,
    adviceLimit: 1,
    intimacyLevel: 'medium',
    styleGuidance: '先共情，再给一个具体、可执行的小建议；不要说教，不要承诺做不到的事。',
  },
  gentle_clarification: {
    policy: 'gentle_clarify',
    sentenceBudget: { min: 1, max: 3 },
    rhythm: 'soft',
    openingMove: 'acknowledge',
    allowedMoves: ['validate_feeling', 'ask_one_question'],
    forbiddenMoves: [
      'lecture',
      'over_explain',
      'multiple_questions',
      'premature_advice',
      'diagnose_user',
      'expose_internal_labels',
    ],
    questionLimit: 1,
    adviceLimit: 0,
    intimacyLevel: 'medium',
    styleGuidance: '先轻轻接住用户，再只问一个低压力问题；不要讲大道理，不要连续追问。',
  },
  memory_ack: {
    policy: 'memory_ack',
    sentenceBudget: { min: 1, max: 2 },
    rhythm: 'natural',
    openingMove: 'acknowledge',
    allowedMoves: ['acknowledge_memory', 'validate_feeling'],
    forbiddenMoves: ['lecture', 'over_explain', 'multiple_questions', 'premature_advice'],
    questionLimit: 0,
    adviceLimit: 0,
    intimacyLevel: 'low',
    styleGuidance: '确认收到，温和回应；不要过度展开。',
  },
  roleplay_flow: {
    policy: 'roleplay_flow',
    sentenceBudget: { min: 2, max: 4 },
    rhythm: 'lively',
    openingMove: 'play',
    allowedMoves: ['continue_roleplay', 'light_tease', 'ask_one_question'],
    forbiddenMoves: ['expose_internal_labels', 'lecture', 'diagnose_user'],
    questionLimit: 1,
    adviceLimit: 0,
    intimacyLevel: 'high',
    styleGuidance: '全情投入角色；不要跳出设定，不要暴露内部逻辑。',
  },
}

@Injectable()
export class PolicyNode {
  private readonly logger = new Logger(PolicyNode.name)

  async execute(
    state: CompanionState,
    _ctx: NodeExecutionContext,
  ): Promise<Partial<CompanionState>> {
    const route = state.route?.route
    if (!route) {
      return { policy: fallbackReplyPolicy as PolicyResult }
    }

    const pack = POLICY_PACKS[route]
    if (!pack) {
      this.logger.log(`[policyNode] no policy pack for route=X, using fallback`)
      return { policy: fallbackReplyPolicy as PolicyResult }
    }

    this.logger.log(`[policyNode] matched policy pack policy=${pack.policy}`)
    const result = replyPolicySchema.parse({
      policy: pack.policy,
      sentenceBudget: pack.sentenceBudget,
      rhythm: pack.rhythm,
      openingMove: pack.openingMove,
      allowedMoves: pack.allowedMoves,
      forbiddenMoves: pack.forbiddenMoves,
      questionLimit: pack.questionLimit,
      adviceLimit: pack.adviceLimit,
      intimacyLevel: pack.intimacyLevel,
      styleGuidance: pack.styleGuidance,
    })
    return { policy: result }
  }
}
