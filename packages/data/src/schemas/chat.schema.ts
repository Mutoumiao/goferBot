import { z } from 'zod'

// ===== Chat Schemas =====

export const messageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  createdAt: z.string(),
  files: z.array(z.object({
    id: z.string(),
    fileName: z.string(),
    fileUrl: z.string(),
  })).optional(),
})

export const sessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  messageCount: z.number().optional().default(0),
})

/** SSE 流式聊天请求 Schema — 前后端共享 */
export const streamChatRequestSchema = z.object({
  input: z.string().min(1, '输入不能为空').max(4000, '输入过长，最多 4000 字符'),
  sessionId: z.string().uuid('sessionId 格式不正确'),
  knowledgeBaseIds: z.array(z.string().uuid()).optional(),
  lastMessageId: z.string().uuid().optional(),
})

export const sendMessageRequestSchema = z.object({
  sessionId: z.string(),
  content: z.string(),
  fileIds: z.array(z.string()).optional(),
  knowledgeBaseIds: z.array(z.string()).optional(),
})

export const createSessionRequestSchema = z.object({
  title: z.string().optional(),
})

export const messageListResponseSchema = z.object({
  messages: z.array(messageSchema),
  total: z.number().optional(),
  hasMore: z.boolean().optional(),
})

export const sessionListResponseSchema = z.object({
  sessions: z.array(sessionSchema),
  total: z.number().optional(),
  hasMore: z.boolean().optional(),
})
