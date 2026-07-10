import { Injectable, Logger } from '@nestjs/common'
import { SettingsService } from '../../modules/settings/settings.service.js'
import { parseModelKey } from '../../modules/settings/model-provider.service.js'
import type { ModelProvider } from '../../modules/settings/dto/settings.dto.js'
import type { KnowledgeAiProviderConfig } from './knowledge-ai.types.js'

/**
 * Resolve embedding (and optional rerank) credentials for Knowledge AI /index and /stream.
 * Prefers settings.rag.embeddingProvider, then any enabled embedding model under providers.
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

    // Prefer dedicated settings.rag.rerankerProvider when set (may differ from embedding provider).
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

    return {
      embedding_model: embeddingModel,
      embedding_api_key: provider.apiKey,
      embedding_base_url: provider.baseUrl,
      ...(rerankModel && rerankProvider
        ? {
            rerank_model: rerankModel,
            rerank_api_key: rerankProvider.apiKey,
            rerank_base_url: rerankProvider.baseUrl,
          }
        : {}),
    }
  }
}
