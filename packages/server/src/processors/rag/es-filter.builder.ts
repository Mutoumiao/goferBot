import { Injectable } from '@nestjs/common'

export interface EsFilterOptions {
  kbIds?: string[]
  documentIds?: string[]
  metadata?: Record<string, unknown>
  allowedUserIds?: string[]
  allowedTeamIds?: string[]
}

/**
 * EsFilterBuilder —— 统一构建 Elasticsearch 过滤条件
 *
 * 提取自 EsVectorService 和 EsKeywordService 中重复的 filter 构建逻辑，
 * 避免多处维护相同代码。
 */
@Injectable()
export class EsFilterBuilder {
  /**
   * 构建用于 `knn.filter` 的 filter 子句数组（向量检索）
   */
  buildFilterClauses(options: EsFilterOptions): unknown[] {
    const clauses: unknown[] = []

    if (options.kbIds && options.kbIds.length > 0) {
      clauses.push({ terms: { kb_id: options.kbIds } })
    }
    if (options.documentIds && options.documentIds.length > 0) {
      clauses.push({ terms: { document_id: options.documentIds } })
    }

    this.addMetadataFilters(clauses, options.metadata)
    this.addAclFilters(clauses, options.allowedUserIds, options.allowedTeamIds)

    return clauses
  }

  /**
   * 构建用于 `bool.must` 的 must 子句数组（BM25 检索）
   */
  buildMustClauses(options: EsFilterOptions): unknown[] {
    const clauses: unknown[] = []

    if (options.kbIds && options.kbIds.length > 0) {
      clauses.push({ terms: { kb_id: options.kbIds } })
    }
    if (options.documentIds && options.documentIds.length > 0) {
      clauses.push({ terms: { document_id: options.documentIds } })
    }

    this.addMetadataFilters(clauses, options.metadata)
    this.addAclFilters(clauses, options.allowedUserIds, options.allowedTeamIds)

    return clauses
  }

  private addMetadataFilters(clauses: unknown[], metadata?: Record<string, unknown>): void {
    if (!metadata) return
    for (const [key, value] of Object.entries(metadata)) {
      if (value === undefined || value === null) continue
      const field = `metadata.${key}`
      if (Array.isArray(value)) {
        clauses.push({ terms: { [field]: value } })
      } else {
        clauses.push({ term: { [field]: value } })
      }
    }
  }

  private addAclFilters(
    clauses: unknown[],
    allowedUserIds?: string[],
    allowedTeamIds?: string[],
  ): void {
    if (allowedUserIds && allowedUserIds.length > 0) {
      clauses.push({
        bool: {
          should: [
            { terms: { allowed_user_ids: allowedUserIds } },
            { bool: { must_not: { exists: { field: 'allowed_user_ids' } } } },
          ],
          minimum_should_match: 1,
        },
      })
    }

    if (allowedTeamIds && allowedTeamIds.length > 0) {
      clauses.push({
        bool: {
          should: [
            { terms: { allowed_team_ids: allowedTeamIds } },
            { bool: { must_not: { exists: { field: 'allowed_team_ids' } } } },
          ],
          minimum_should_match: 1,
        },
      })
    }
  }
}
