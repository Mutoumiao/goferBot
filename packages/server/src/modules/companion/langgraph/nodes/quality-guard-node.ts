import { fallbackReplyQualityGuard, replyQualityGuardSchema } from '@goferbot/data/schemas'
import { Injectable, Logger } from '@nestjs/common'
import type { CompanionState, NodeExecutionContext, QualityGuardResult } from '../interfaces.js'

const FORBIDDEN_PATTERNS: Array<{
  code: QualityGuardResult['violations'][number]['code']
  pattern: RegExp
  severity: QualityGuardResult['violations'][number]['severity']
}> = [
  {
    code: 'internal_label_leak',
    pattern: /(意图判断|情绪识别|关系阶段|策略路由|回复策略包|记忆候选|安全边界)/g,
    severity: 'high',
  },
  {
    code: 'forbidden_lecture',
    pattern: /(你应该|你必须|你要知道|这都是因为|你总是|你从来|你根本)/g,
    severity: 'medium',
  },
  {
    code: 'forbidden_premature_advice',
    pattern: /(我建议你|你应该试试|你最好|试试这样|建议你|最好别|最好去)/g,
    severity: 'medium',
  },
  {
    code: 'forbidden_diagnosis',
    pattern: /(你这是|你得了|你属于|典型的|就是太|你有.*(倾向|问题|障碍))/g,
    severity: 'high',
  },
  {
    code: 'forbidden_real_world_promise',
    pattern: /(我会去找你|我会陪你去|我会打电话|我会出现在|我帮你联系|我去找)/g,
    severity: 'high',
  },
  {
    code: 'breaks_immersion',
    pattern: /(作为一个AI|我是一个AI|根据我的程序|我的算法|系统提示|我被设置|我的开发者)/g,
    severity: 'high',
  },
  {
    code: 'forbidden_over_explain',
    pattern: /(首先|其次|最后|原因是由于|这是因为|让我解释一下|我来详细说说)/g,
    severity: 'low',
  },
  {
    code: 'forbidden_intense_flirt',
    pattern: /(宝贝|亲爱的|我好想你|喜欢你|爱你|想抱抱|亲亲)/g,
    severity: 'medium',
  },
  {
    code: 'forbidden_aggressive_siding',
    pattern: /(你完全没错|全是他的错|他就是个|别理他|这种人就该|你做得对极了)/g,
    severity: 'medium',
  },
  {
    code: 'forbidden_pressure',
    pattern: /(你必须|你一定要|现在就|立刻|马上|你再不|你就不能)/g,
    severity: 'medium',
  },
]

@Injectable()
export class QualityGuardNode {
  private readonly logger = new Logger(QualityGuardNode.name)

  async execute(
    state: CompanionState,
    _ctx: NodeExecutionContext,
  ): Promise<Partial<CompanionState>> {
    const reply = state.assistantReply
    if (!reply) {
      return { quality: fallbackReplyQualityGuard as QualityGuardResult }
    }

    const sentences = this.splitSentences(reply)
    const sentenceCount = sentences.length
    const questionCount = sentences.filter((s) => /[？?]$/.test(s.trim())).length
    const adviceCount = sentences.filter((s) => /建议|应该|最好|试试/.test(s)).length

    const violations: QualityGuardResult['violations'] = []

    if (sentenceCount > 4) {
      violations.push({
        code: 'too_many_sentences',
        severity: 'medium',
        evidence: `当前回复共 ${sentenceCount} 句，超过建议上限 4 句。`,
      })
    }
    if (questionCount > 2) {
      violations.push({
        code: 'too_many_questions',
        severity: 'medium',
        evidence: `当前回复共 ${questionCount} 个问题，超过建议上限 2 个。`,
      })
    }
    if (adviceCount > 1) {
      violations.push({
        code: 'too_many_suggestions',
        severity: 'low',
        evidence: `当前回复含 ${adviceCount} 个建议，建议上限为 1 个。`,
      })
    }

    for (const { code, pattern, severity } of FORBIDDEN_PATTERNS) {
      const match = pattern.exec(reply)
      if (match) {
        violations.push({
          code,
          severity,
          evidence: `命中模式: "${match[0]}"`,
        })
      }
    }

    const hasHigh = violations.some((v) => v.severity === 'high')
    const hasMedium = violations.some((v) => v.severity === 'medium')
    const score = Math.max(0, 1 - violations.length * 0.15)
    const status = hasHigh ? 'fail' : hasMedium ? 'warn' : 'pass'

    const result = replyQualityGuardSchema.parse({
      status,
      score,
      sentenceCount,
      questionCount,
      adviceCount,
      violations: violations.slice(0, 12),
    })

    this.logger.debug(`[qualityGuardNode] status=${status} violations=${violations.length}`)
    return { quality: result }
  }

  private splitSentences(text: string): string[] {
    return text
      .split(/(?<=[。！？!?\n])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }
}
