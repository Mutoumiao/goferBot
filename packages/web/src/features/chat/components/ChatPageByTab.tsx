import { useCallback, useEffect, useRef, useState } from "react";
import { XProvider } from "@ant-design/x";
import { useXChat } from "@ant-design/x-sdk";
import type { Message } from "@goferbot/data";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useConversationStore } from "@/stores/conversation.store";
import { useChatStore } from "../store";
import {
  createGoferProvider,
  fetchProviders,
  loadChatHistory,
} from "../services";
import type { GoferMessage, GoferInput } from "../providers/GoferChatProvider";
import type { PendingMessage } from "../services";
import { getPendingMessageKey } from "../constants";
import { ChatTempHome } from "./ChatTempHome";
import { ChatSessionView } from "./ChatSessionView";

interface ChatPageByTabProps {
  tabId: string;
}

function messagesToMessageInfos(messages: Message[]) {
  return messages.map((message) => ({
    id: message.id,
    message: {
      content: message.content,
      role: message.role as GoferMessage["role"],
    },
    status: "success" as const,
  }));
}

function xMessagesToMessages(
  xMessages: { id: number | string; message: GoferMessage }[],
  conversationId: string,
): Message[] {
  return xMessages.map((xMsg, index) => ({
    id: typeof xMsg.id === "string" ? xMsg.id : `msg-${index}`,
    sessionId: conversationId,
    role: xMsg.message.role,
    content: xMsg.message.content,
    createdAt: new Date().toISOString(),
  }));
}

export function ChatPageByTab({ tabId }: ChatPageByTabProps) {
  const tab = useWorkspaceStore((s) => s.tabs.find((t) => t.id === tabId));
  const pendingSentRef = useRef(false);

  const providerRef = useState(() => createGoferProvider())[0];

  const conversationId = tab?.conversationId;

  const { selectedProviderKey, setSelectedProviderKey } = useChatStore();
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null);

  const {
    messages: xMessages,
    onRequest,
    isRequesting,
    abort,
    setMessages,
  } = useXChat<GoferMessage, GoferMessage, GoferInput>({
    provider: providerRef,
    requestPlaceholder: () => ({
      content: "正在思考中...",
      role: "assistant",
    }),
    requestFallback: (_, { error: err, messageInfo }) => {
      if (err.name === "AbortError") {
        return {
          content: messageInfo?.message?.content || "已取消回复",
          role: "assistant",
        };
      }
      return {
        content: "网络异常，请稍后重试",
        role: "assistant",
      };
    },
  });

  // 初始化 providers
  useEffect(() => {
    fetchProviders();
  }, []);

  // 当 conversationId 变化时重置 pending 发送标记，避免切换会话后漏发
  useEffect(() => {
    pendingSentRef.current = false;
  }, [conversationId]);

  // 当 tab 首次绑定 conversationId 时，加载历史消息
  useEffect(() => {
    if (!conversationId) return;

    const conversationStore = useConversationStore.getState();
    const cached = conversationStore.conversationMap[conversationId];

    if (cached?.messages.length) {
      setMessages(messagesToMessageInfos(cached.messages));
      return;
    }

    // 先清空旧会话消息，避免在加载新历史期间显示旧内容
    setMessages([]);
    let stale = false;
    loadChatHistory(conversationId).then(() => {
      if (stale) return;
      const fresh =
        useConversationStore.getState().conversationMap[conversationId]
          ?.messages ?? [];
      setMessages(messagesToMessageInfos(fresh));
    });

    return () => {
      stale = true;
    };
  }, [conversationId, setMessages]);

  // 同步 useXChat 消息到 conversation store
  useEffect(() => {
    if (!conversationId || xMessages.length === 0) return;
    const messages = xMessagesToMessages(xMessages, conversationId);
    useConversationStore.getState().setMessages(conversationId, messages);
  }, [conversationId, xMessages]);

  // 自动发送 pending message
  useEffect(() => {
    if (pendingSentRef.current) return;
    if (!conversationId) return;

    const pendingKey = getPendingMessageKey(conversationId);
    const raw = sessionStorage.getItem(pendingKey);
    if (!raw) return;

    sessionStorage.removeItem(pendingKey);
    pendingSentRef.current = true;

    let pending: PendingMessage;
    try {
      pending = JSON.parse(raw) as PendingMessage;
      if (
        typeof pending !== "object" ||
        pending === null ||
        typeof pending.content !== "string"
      ) {
        throw new Error("invalid pending format");
      }
    } catch {
      pending = { content: raw };
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      onRequest({
        response_mode: "streaming",
        query: pending.content.trim(),
        conversation_id: conversationId,
        provider_key: selectedProviderKey ?? undefined,
        knowledge_base_ids: pending.knowledgeBaseIds,
      } as GoferInput);
    });

    return () => {
      cancelled = true;
    };
  }, [conversationId, onRequest, selectedProviderKey]);

  const handleRetry = useCallback(() => {
    const lastUserMsg = [...xMessages]
      .reverse()
      .find((m) => m.message.role === "user");
    if (lastUserMsg && conversationId) {
      onRequest({
        response_mode: "streaming",
        query: lastUserMsg.message.content,
        conversation_id: conversationId,
        provider_key: selectedProviderKey ?? undefined,
        knowledge_base_ids: selectedKbId ? [selectedKbId] : undefined,
      } as GoferInput);
    }
  }, [xMessages, conversationId, onRequest, selectedProviderKey, selectedKbId]);

  if (!tab) {
    return (
      <div className="flex h-full items-center justify-center text-text-secondary">
        正在恢复标签...
      </div>
    );
  }

  if (!conversationId) {
    return <ChatTempHome tabId={tabId} />;
  }

  return (
    <XProvider>
      <ChatSessionView
        conversationId={conversationId}
        xMessages={xMessages}
        onRequest={(params) => onRequest(params as GoferInput)}
        isRequesting={isRequesting}
        onRetry={handleRetry}
        onAbort={abort}
        selectedProviderKey={selectedProviderKey}
        onChangeProvider={setSelectedProviderKey}
        selectedKbId={selectedKbId}
        onSelectKb={setSelectedKbId}
      />
    </XProvider>
  );
}
