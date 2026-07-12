import { Injectable, Logger } from '@nestjs/common'
import { SettingsService } from '../../modules/settings/settings.service.js'
import { parseModelKey } from '../../modules/settings/model-provider.service.js'
import type { ModelProvider } from '../../modules/settings/dto/settings.dto.js'
import {
  inferKnowledgeAiProviderKind,
  normalizeProviderServiceRoot,
  rewriteLoopbackForKnowledgeAi,
} from '../../modules/settings/providers/index.js'
import type { KnowledgeAiProviderConfig } from './knowledge-ai.types.js'

/**
 * Resolve embedding (and optional rerank) credentials for Knowledge AI /index and /stream.
 * Prefers settings.rag.embeddingProvider, then any enabled embedding model under providers.
 *
 * Passes service-root baseUrl + provider_kind; Knowledge AI adapters own vendor paths.
 */
@Injectable()
export class KnowledgeAiProviderResolver {
  private readonly logger = new Logger(KnowledgeAiProviderResolver.name)

  constructor(private readonly settingsService: SettingsService) {}

  async resolveEmbeddingConfig(userId: string): Promise<KnowledgeAiProviderConfig> {
    const settings = await this.settingsService.getDecryptedSettings(userId)
    const providers = settings.providers ?? {}
    const rerankerKey = settings.rag?.rerankerProvider?.trim()

    const preferredKey = settings.rag?.embeddingProvider?.trim()
    if (preferredKey) {
      const { providerId, modelName } = parseModelKey(preferredKey)
      const provider = providers[providerId]
      if (provider?.enabled) {
        const emb = this.pickEmbeddingModel(provider, modelName)
        if (emb) {
          return this.buildConfig(provider, emb.name, providers, rerankerKey)
        }
        this.logger.warn(
          `rag.embeddingProvider=${preferredKey} has no enabled embedding model; scanning pool`,
        )
      }
    }

    for (const provider of Object.values(providers)) {
      if (!provider?.enabled) continue
      const emb = this.pickEmbeddingModel(provider)
      if (emb) {
        return this.buildConfig(provider, emb.name, providers, rerankerKey)
      }
    }

    throw new Error(
      '未配置可用的 embedding 模型：请在设置中启用 embedding，或配置 rag.embeddingProvider',
    )
  }

  private pickEmbeddingModel(provider: ModelProvider, preferredName?: string) {
    if (preferredName) {
      const exact = provider.models.find(
        (m) => m.name === preferredName && m.type === 'embedding' && m.enabled,
      )
      if (exact) return exact
    }
    return provider.models.find((m) => m.type === 'embedding' && m.enabled)
  }

  private toKnowledgeBaseUrl(raw: string): string {
    return rewriteLoopbackForKnowledgeAi(normalizeProviderServiceRoot(raw))
  }

  private buildConfig(
    provider: ModelProvider,
    embeddingModel: string,
    allProviders?: Record<string, ModelProvider>,
    rerankerProviderKey?: string,
  ): KnowledgeAiProviderConfig {
    const localRerank = provider.models.find(
      (m) => ((m.type as string) === 'rerank' || m.type === 'reranker') && m.enabled,
    )
    let rerankModel = localRerank?.name
    let rerankProvider = localRerank ? provider : undefined

    if (rerankerProviderKey && allProviders) {
      const { providerId, modelName } = parseModelKey(rerankerProviderKey)
      const rp = allProviders[providerId]
      if (rp?.enabled) {
        const rm =
          (modelName
            ? rp.models.find(
                (m) =>
                  m.name === modelName &&
                  ((m.type as string) === 'rerank' || m.type === 'reranker') &&
                  m.enabled,
              )
            : undefined) ??
          rp.models.find(
            (m) => ((m.type as string) === 'rerank' || m.type === 'reranker') && m.enabled,
          )
        if (rm) {
          rerankModel = rm.name
          rerankProvider = rp
        }
      }
    }

    const baseUrl = provider.baseUrl?.trim()
    if (!baseUrl) {
      throw new Error(
        `Provider ${provider.id ?? provider.name ?? '(unknown)'} 未配置 baseUrl：` +
          'Knowledge AI 不使用任何默认厂商地址，请在 Admin Provider 中填写 API Base URL',
      )
    }
    if (!provider.apiKey?.trim()) {
      throw new Error(
        `Provider ${provider.id ?? provider.name ?? '(unknown)'} 未配置 apiKey：` +
          '索引/检索需要可用的 embedding 凭证',
      )
    }

    const embKind = inferKnowledgeAiProviderKind(provider.id, provider.name, baseUrl)
    const embRoot = this.toKnowledgeBaseUrl(baseUrl)

    let rerankBlock: Pick<
      KnowledgeAiProviderConfig,
      'rerank_model' | 'rerank_api_key' | 'rerank_base_url' | 'rerank_provider_kind'
    > = {}
    if (rerankModel && rerankProvider) {
      const rerankBase = rerankProvider.baseUrl?.trim()
      if (!rerankBase) {
        this.logger.warn(
          `rerank model ${rerankModel} selected but provider baseUrl is empty; skip rerank injection`,
        )
      } else {
        const rerankKind = inferKnowledgeAiProviderKind(
          rerankProvider.id,
          rerankProvider.name,
          rerankBase,
        )
        if (rerankKind === 'ollama') {
          // Native Ollama has no /rerank HTTP API — skip to avoid noisy degrade.
          this.logger.warn(
            `rerank model ${rerankModel} is Ollama-backed; Knowledge AI has no Ollama rerank adapter, skipping injection`,
          )
        } else {
          rerankBlock = {
            rerank_model: rerankModel,
            rerank_api_key: rerankProvider.apiKey,
            rerank_base_url: this.toKnowledgeBaseUrl(rerankBase),
            rerank_provider_kind: rerankKind,
          }
        }
      }
    }

    return {
      embedding_model: embeddingModel,
      embedding_api_key: provider.apiKey,
      embedding_base_url: embRoot,
      embedding_provider_kind: embKind,
      ...rerankBlock,
    }
  }
}
