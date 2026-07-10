import type { SSEOutput, TransformMessage, XRequestOptions } from '@ant-design/x-sdk'
import { AbstractChatProvider } from '@ant-design/x-sdk'
import type { ChatMessagesChunk, ChatMessagesRequest, ChatSourceItem } from '@goferbot/data'

export type GoferInput = ChatMessagesRequest

export type GoferOutput = ChatMessagesChunk

export interface GoferMessage {
  content: string
  role: 'user' | 'assistant'
  /** Sources from Knowledge AI (may arrive before content deltas). */
  sources?: ChatSourceItem[]
  retrieval_empty?: boolean
}

export class GoferChatProvider extends AbstractChatProvider<GoferMessage, GoferInput, SSEOutput> {
  transformParams(
    requestParams: Partial<GoferInput>,
    _options: XRequestOptions<GoferInput, SSEOutput, GoferMessage>,
  ): GoferInput {
    return {
      response_mode: 'streaming',
      query: requestParams.query || '',
      conversation_id: requestParams.conversation_id || '',
      provider_key: requestParams.provider_key,
      parent_message_id: requestParams.parent_message_id,
      inputs: requestParams.inputs,
      files: requestParams.files,
      knowledge_base_ids: requestParams.knowledge_base_ids ?? [],
      retrieval_mode: requestParams.retrieval_mode ?? 'strict',
    }
  }

  transformLocalMessage(requestParams: Partial<GoferInput>): GoferMessage {
    return {
      content: requestParams.query || '',
      role: 'user',
    }
  }

  transformMessage(info: TransformMessage<GoferMessage, SSEOutput>): GoferMessage {
    const { originMessage, chunk } = info
    let data: GoferOutput | undefined
    try {
      if (typeof chunk?.data === 'string') {
        data = JSON.parse(chunk.data) as GoferOutput
      }
    } catch {
      data = undefined
    }

    if (!data) {
      return {
        content: originMessage?.content || '',
        role: 'assistant',
        sources: originMessage?.sources,
        retrieval_empty: originMessage?.retrieval_empty,
      }
    }

    if (data.event === 'sources') {
      return {
        content: originMessage?.content || '',
        role: 'assistant',
        sources: data.sources ?? [],
        retrieval_empty: data.retrieval_empty,
      }
    }

    if (data.event === 'error') {
      return {
        content: data.error || data.answer || '生成失败',
        role: 'assistant',
        sources: originMessage?.sources,
        retrieval_empty: originMessage?.retrieval_empty,
      }
    }

    if (data.event === 'message_end') {
      return {
        content: data.answer || originMessage?.content || '',
        role: 'assistant',
        sources: originMessage?.sources,
        retrieval_empty: data.retrieval_empty ?? originMessage?.retrieval_empty,
      }
    }

    // message deltas
    if (data.event === 'message') {
      return {
        content: `${originMessage?.content || ''}${data.answer || ''}`,
        role: 'assistant',
        sources: originMessage?.sources,
        retrieval_empty: originMessage?.retrieval_empty,
      }
    }

    // Fallback for legacy frames with error/done fields
    const legacy = data as GoferOutput & { error?: string; done?: boolean; answer?: string }
    if ('error' in legacy && legacy.error) {
      return {
        content: String(legacy.error),
        role: 'assistant',
        sources: originMessage?.sources,
      }
    }

    return {
      content: `${originMessage?.content || ''}${(legacy as { answer?: string }).answer || ''}`,
      role: 'assistant',
      sources: originMessage?.sources,
      retrieval_empty: originMessage?.retrieval_empty,
    }
  }
}
