import { Injectable, Logger } from '@nestjs/common'

export type RouterIntent =
  | 'code_search'
  | 'fact_qa'
  | 'time_range'
  | 'relation_qa'
  | 'chitchat'
  | 'general'

export interface RouterDecision {
  intent: RouterIntent
  pipeline: {
    mode: 'vector' | 'bm25' | 'hybrid'
    vectorWeight: number
    bm25Weight: number
    needRerank: boolean
    needFullContext: boolean
    topK: number
    candidateK: number
  }
}

const CODE_PATTERNS = [
  /[A-Z][a-z]+(?:Error|Exception|ERR_\w+|WARN_\w+)/,
  /\b(function|class|interface|method|api)\b/i,
  /[a-zA-Z_]\w*\([^)]*\)/,
  /@\w+/,
  /\b(async|await|return|import|export)\b/i,
  /\b(HTTP|REST|GraphQL|SQL|JSON|XML|YAML)\b/i,
  /\b(TCP|UDP|IP|DNS|SSL|TLS|JWT|OAuth)\b/i,
]

const TIME_PATTERNS = [
  /\d{4}年/,
  /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/,
  /\d{4}s?/,
  /(?:去年|今年|明年|近期|最近|最新|以前|之后|以后|截至|截止|至今)/,
  /(?:before|after|since|until|latest|recent|previous)/i,
]

const RELATION_PATTERNS = [
  /(?:依赖|引用|包含|使用|调用|导入|关联|关系|影响|涉及)/,
  /(?:depends?|imports?|uses?|calls?|includes?|related?|affects?)/i,
  /(?:谁|哪个|哪些).*(?:的|之).*(?:依赖|依赖|使用|包含)/,
  /(?:compare|对比|比较|vs|versus)/i,
]

const FACT_PATTERNS = [
  /(?:是什么|什么是|定义|介绍|解释|介绍一下)/,
  /(?:what is|define|explain|describe|meaning of)/i,
  /(?:如何|怎么|怎样|为什么|原因|原理)/,
  /(?:how to|how does|why|does .* work)/i,
]

const CHITCHAT_PATTERNS = [
  /^(?:你好|hi|hello|谢谢|thanks|再见|bye)[!！\s]*$/i,
  /(?:你是谁|who are you|自我介绍)/i,
]

/**
 * RouterService —— RAG 的「意图分诊台」
 *
 *   不同的问题用不同的检索策略效果不同。比如"function X 怎么写"是代码搜索，
 *   用 BM25 更准；"系统架构是什么"是事实问答，用向量+重排更好。
 *
 *   本服务用一组**正则规则**给 query 打标签（intent），然后按意图返回
 *   最优 Pipeline 配置（mode / 权重 / topK / 是否重排 / 是否完整上下文）。
 *
 *   这是**零成本**实现，没有调用 LLM/BERT，延迟可忽略。未来如果规则不够用，
 *   可以在保持接口不变的前提下切换为 BERT 分类器或 LLM 路由。
 *
 * 意图 → Pipeline 映射速记：
 *   code_search  → bm25  偏重词法，不要重排，不要完整上下文
 *   time_range   → vector 偏重语义，要重排，要完整上下文
 *   relation_qa  → hybrid 均衡，要重排，要完整上下文
 *   fact_qa      → hybrid 默认，要重排，要完整上下文
 *   chitchat     → vector 轻量化，不重排，小 topK
 *   general      → hybrid 默认（兜底）
 */
@Injectable()
export class RouterService {
  private readonly logger = new Logger(RouterService.name)

  constructor() { }

  /**
   * Rule-based intent router. Zero-cost heuristic that avoids unnecessary
   * heavy-pipeline work (e.g., rerank for code-search queries).
   *
   * This is a first implementation. When production data allows it, it can
   * be swapped for a lightweight classifier (BERT) or LLM-based router
   * behind the same interface.
   */
  decide(query: string): RouterDecision {
    const intent = this.classify(query)
    const pipeline = this.selectPipeline(intent)

    this.logger.debug(
      `[Router] intent=${intent} mode=${pipeline.mode} rerank=${pipeline.needRerank} topK=${pipeline.topK}`,
    )

    return { intent, pipeline }
  }

  /**
   * 规则式意图分类器（零推理成本）
   *
   * 匹配顺序：chitchat → time_range → code_search → relation_qa → fact_qa → general
   *
   * 顺序很重要：越具体的规则越先匹配。比如 "2024 年新增了 function X"
   * 同时命中时间和代码，应该优先识别为时间范围（更严格的规则）。
   */
  classify(query: string): RouterIntent {
    const q = query.trim()
    if (!q) return 'general'

    if (CHITCHAT_PATTERNS.some((p) => p.test(q))) return 'chitchat'
    if (TIME_PATTERNS.some((p) => p.test(q))) return 'time_range'
    if (CODE_PATTERNS.some((p) => p.test(q))) return 'code_search'
    if (RELATION_PATTERNS.some((p) => p.test(q))) return 'relation_qa'
    if (FACT_PATTERNS.some((p) => p.test(q))) return 'fact_qa'

    return 'general'
  }

  private selectPipeline(intent: RouterIntent): RouterDecision['pipeline'] {
    switch (intent) {
      case 'code_search':
        return {
          mode: 'bm25',
          vectorWeight: 0.2,
          bm25Weight: 0.8,
          needRerank: false,
          needFullContext: false,
          topK: 5,
          candidateK: 30,
        }
      case 'time_range':
        return {
          mode: 'vector',
          vectorWeight: 0.8,
          bm25Weight: 0.2,
          needRerank: true,
          needFullContext: true,
          topK: 5,
          candidateK: 60,
        }
      case 'relation_qa':
        return {
          mode: 'hybrid',
          vectorWeight: 0.5,
          bm25Weight: 0.5,
          needRerank: true,
          needFullContext: true,
          topK: 8,
          candidateK: 80,
        }
      case 'fact_qa':
      case 'general':
        return {
          mode: 'hybrid',
          vectorWeight: 0.7,
          bm25Weight: 0.3,
          needRerank: true,
          needFullContext: true,
          topK: 5,
          candidateK: 60,
        }
      case 'chitchat':
      default:
        return {
          mode: 'vector',
          vectorWeight: 0.5,
          bm25Weight: 0.5,
          needRerank: false,
          needFullContext: false,
          topK: 3,
          candidateK: 20,
        }
    }
  }
}
