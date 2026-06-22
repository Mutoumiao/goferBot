import { Injectable, Logger } from '@nestjs/common'

export interface GuardrailResult {
  safe: boolean
  filteredText: string
  redactions: Redaction[]
  warnings: string[]
}

export interface Redaction {
  type: 'email' | 'phone' | 'id_card' | 'bank_card' | 'sensitive_keyword'
  original: string
  redacted: string
}

const DEFAULT_SENSITIVE_KEYWORDS = [
  '密码',
  '密钥',
  'secret',
  'password',
  'api key',
  'access_key',
  'private_key',
  'token',
  'credential',
  '内部机密',
  '绝密',
  'confidential',
  'classified',
]

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const PHONE_REGEX = /(?<!\d)(?:\+?\d{1,3}[- ]?)?\d{3}[- ]?\d{4}[- ]?\d{4}(?!\d)/g
const ID_CARD_REGEX = /(?<!\d)\d{17}[\dXx](?!\d)/g
const BANK_CARD_REGEX = /(?<!\d)\d{16,19}(?!\d)/g

/**
 * GuardrailService —— RAG 的「输出安全护栏」
 *
 *   LLM 生成的答案可能含有敏感信息（邮箱、手机号、身份证、银行卡号）
 *   或"密码""密钥""confidential"等敏感关键词。本服务在答案返回给
 *   用户前做最后一道过滤。
 *
 * 三件事：
 *   1) PII 脱敏：正则匹配 email/phone/id_card/bank_card → 替换为 [XXX REDACTED]
 *   2) 敏感关键词检测：命中时追加 warning（**仅警告，不阻断**）
 *   3) 领域免责声明：指定 domain 时自动追加对应声明（医疗/金融/法律）
 *
 * ⚠️ 已知风险：
 *   流式场景下 Guardrail 是「事后过滤」——LLM 中间输出的 PII 会先经 SSE
 *   传到客户端再被替换。改进方案是在 SseResponseHelper 层加滑动窗口过滤。
 */
@Injectable()
export class GuardrailService {
  private readonly logger = new Logger(GuardrailService.name)
  private readonly sensitiveKeywords: string[]

  constructor() {
    this.sensitiveKeywords = DEFAULT_SENSITIVE_KEYWORDS.map((k) => k.toLowerCase())
  }

  /**
   * 执行输出安全过滤
   *
   * 执行顺序：
   *   1) 依次对 email / phone / id_card / bank_card 做正则脱敏
   *      （每次替换都记录原始匹配，便于审计和给前端展示）
   *   2) 检测敏感关键词 → 追加 warning（不阻断回答）
   *   3) 若指定 domain（medical/financial/legal），追加对应免责声明
   *
   * 新人注意：
   *   本服务**不是审查答案正确性**，只处理「不该泄漏的信息」。
   *   safe=false 表示发生了脱敏，但答案依然可用；脱敏信息通过 redactions
   *   返回给上层，用于审计日志。
   */
  apply(text: string, options: { domain?: 'medical' | 'financial' | 'legal' | 'general' } = {}): GuardrailResult {
    if (!text) {
      return { safe: true, filteredText: '', redactions: [], warnings: [] }
    }

    const redactions: Redaction[] = []
    let filtered = text

    filtered = this.redactPattern(filtered, EMAIL_REGEX, (m) => {
      redactions.push({ type: 'email', original: m, redacted: '[EMAIL REDACTED]' })
      return '[EMAIL REDACTED]'
    })

    filtered = this.redactPattern(filtered, PHONE_REGEX, (m) => {
      redactions.push({ type: 'phone', original: m, redacted: '[PHONE REDACTED]' })
      return '[PHONE REDACTED]'
    })

    filtered = this.redactPattern(filtered, ID_CARD_REGEX, (m) => {
      redactions.push({ type: 'id_card', original: m, redacted: '[ID CARD REDACTED]' })
      return '[ID CARD REDACTED]'
    })

    filtered = this.redactPattern(filtered, BANK_CARD_REGEX, (m) => {
      redactions.push({ type: 'bank_card', original: m, redacted: '[BANK CARD REDACTED]' })
      return '[BANK CARD REDACTED]'
    })

    const warnings: string[] = []
    const lowerText = text.toLowerCase()
    const foundKeywords = this.sensitiveKeywords.filter((kw) => lowerText.includes(kw))
    if (foundKeywords.length > 0) {
      warnings.push(
        `Answer contains sensitive keywords: ${foundKeywords.join(', ')}. Review before sharing.`,
      )
    }

    if (options.domain && options.domain !== 'general') {
      const disclaimers: Record<string, string> = {
        medical: '本回答仅供参考，不能替代专业医生的诊断。',
        financial: '本回答仅供参考，不构成投资建议。',
        legal: '本回答仅供参考，具体法律问题请咨询专业律师。',
      }
      const disclaimer = disclaimers[options.domain]
      if (disclaimer && !filtered.includes(disclaimer)) {
        const lastSentence = /[。!！.？?]$/.test(filtered.trim())
        filtered = filtered + (lastSentence ? ' ' : ' ') + disclaimer
        warnings.push(`Disclaimer appended for ${options.domain} domain.`)
      }
    }

    if (redactions.length > 0) {
      this.logger.warn(
        `[Guardrail] Redacted ${redactions.length} PII occurrences: ${redactions.map((r) => r.type).join(',')}`,
      )
    }

    return {
      safe: redactions.length === 0,
      filteredText: filtered,
      redactions,
      warnings,
    }
  }

  private redactPattern(text: string, regex: RegExp, replacer: (match: string) => string): string {
    let result = text
    const matches = text.match(regex) ?? []
    for (const match of matches) {
      result = result.replace(match, replacer(match))
    }
    return result
  }
}
