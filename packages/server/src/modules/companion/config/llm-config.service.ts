import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';

@Injectable()
export class LlmConfigService {
  private readonly logger = new Logger(LlmConfigService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * 获取统一的 LLM 配置
   * 复用现有 RAG_LLM_* 环境变量
   */
  getLlmConfig(): { apiKey: string; model: string; baseURL?: string; timeout: number } {
    const apiKey =
      this.configService.get<string>('RAG_LLM_API_KEY') ??
      this.configService.get<string>('LLM_API_KEY');
    const model =
      this.configService.get<string>('RAG_LLM_MODEL') ??
      this.configService.get<string>('LLM_MODEL') ??
      'gpt-4o-mini';
    const baseURL =
      this.configService.get<string>('RAG_LLM_BASE_URL') ??
      this.configService.get<string>('LLM_BASE_URL');
    const timeout =
      this.configService.get<number>('RAG_LLM_TIMEOUT_MS') ??
      this.configService.get<number>('LLM_TIMEOUT_MS') ??
      60_000;

    if (!apiKey) {
      throw new Error('Companion LLM 未配置：请设置 RAG_LLM_API_KEY 或 LLM_API_KEY 环境变量');
    }

    return { apiKey, model, baseURL, timeout };
  }

  /**
   * 创建 LangChain ChatModel 实例
   * 为 companion 模块提供独立的 LLM 客户端
   */
  createLangChainChatModel(overrides?: Partial<ConstructorParameters<typeof ChatOpenAI>[0]>): ChatOpenAI {
    const config = this.getLlmConfig();

    this.logger.debug(`Creating LangChain ChatOpenAI model: ${config.model}`);

    return new ChatOpenAI({
      apiKey: config.apiKey,
      model: config.model,
      ...(config.baseURL ? { configuration: { baseURL: config.baseURL } } : {}),
      timeout: config.timeout,
      ...overrides,
    });
  }
}
